import React, { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';
import { getCurrentTenantContext, withSchoolId } from '../services/tenantService';

type AppStudent = {
  id: string;
  name: string;
};

type AppClass = {
  id: string;
  name: string;
};

type ReportCardRow = {
  id: string;
  student_id: string;
  class_id: string | null;
  report_date: string;
  report_type: 'uploaded' | 'generated';
  title: string | null;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
};

type FormMode = 'upload' | 'create' | 'template';

type TextBox = {
  id: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  text: string;
  label: string;
};

const REPORT_CARD_BUCKET = 'report_cards';
const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const isSchemaMissing = (message?: string | null) => {
  const text = String(message || '').toLowerCase();
  return /does not exist|relation|column|schema cache/.test(text);
};

const extractStoragePath = (rawValue: string | null): string | null => {
  if (!rawValue) return null;
  const candidate = rawValue.trim();
  if (!candidate) return null;

  if (/^https?:\/\//i.test(candidate)) {
    const marker = `/object/public/${REPORT_CARD_BUCKET}/`;
    const markerIndex = candidate.indexOf(marker);
    if (markerIndex >= 0) {
      const remainder = candidate.slice(markerIndex + marker.length).split('?')[0];
      return decodeURIComponent(remainder);
    }
    return null;
  }

  return candidate.replace(/^\/+/, '') || null;
};

const renderReportPdfBlob = (payload: {
  studentName: string;
  reportDate: string;
  title: string;
  content: string;
}) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 64;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Student Report Card', marginX, y);

  y += 34;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Student: ${payload.studentName}`, marginX, y);

  y += 22;
  doc.text(`Date: ${new Date(payload.reportDate).toLocaleDateString()}`, marginX, y);

  y += 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(payload.title || 'Report', marginX, y);

  y += 24;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(payload.content || '', 500);
  doc.text(lines, marginX, y);

  return doc.output('blob');
};

export default function ReportCardPage() {
  const [students, setStudents] = useState<AppStudent[]>([]);
  const [classes, setClasses] = useState<AppClass[]>([]);
  const [availableClasses, setAvailableClasses] = useState<AppClass[]>([]);
  const [reportCards, setReportCards] = useState<ReportCardRow[]>([]);

  const [mode, setMode] = useState<FormMode>('upload');
  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingStudentClasses, setIsLoadingStudentClasses] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isConfirmActionSubmitting, setIsConfirmActionSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => Promise<void> | void } | null>(null);

  const [formData, setFormData] = useState({
    student_id: '',
    class_id: '',
    report_date: getTodayIso(),
    title: '',
    content: '',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Template mode state
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateObjectUrl, setTemplateObjectUrl] = useState<string | null>(null);
  const [templateFileType, setTemplateFileType] = useState<'image' | 'pdf' | null>(null);
  const [isAnalyzingTemplate, setIsAnalyzingTemplate] = useState(false);
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [draggingBoxId, setDraggingBoxId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const templateContainerRef = useRef<HTMLDivElement | null>(null);
  const templateFileInputRef = useRef<HTMLInputElement | null>(null);

  const studentMap = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [students]);

  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [classes]);

  const fetchBaseData = async () => {
    setIsLoadingBase(true);
    setError(null);

    try {
      const [studentsResult, classesResult] = await Promise.all([
        supabase
          .from('students')
          .select('id, name')
          .order('created_at', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name')
          .order('created_at', { ascending: false }),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (classesResult.error) throw classesResult.error;

      let reportRowsData: any[] = [];
      {
        const primaryReportsResult = await supabase
          .from('report_cards')
          .select('id, student_id, class_id, report_date, report_type, title, content, file_path, file_name, created_at')
          .order('created_at', { ascending: false });

        if (!primaryReportsResult.error) {
          reportRowsData = primaryReportsResult.data || [];
        } else if (isSchemaMissing(primaryReportsResult.error.message)) {
          const fallbackReportsResult = await supabase
            .from('report_cards')
            .select('id, student_id, report_date, report_type, title, content, file_path, file_name, created_at')
            .order('created_at', { ascending: false });

          if (fallbackReportsResult.error) throw fallbackReportsResult.error;
          reportRowsData = fallbackReportsResult.data || [];
        } else {
          throw primaryReportsResult.error;
        }
      }

      const studentRows = (studentsResult.data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || row.full_name || `Student ${row.id}`),
      }));

      const classRows = (classesResult.data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || `Class ${row.id}`),
      }));

      const reportRows = reportRowsData.map((row: any) => ({
        id: String(row.id),
        student_id: String(row.student_id || ''),
        class_id: row.class_id ? String(row.class_id) : null,
        report_date: String(row.report_date || getTodayIso()),
        report_type: String(row.report_type || 'uploaded') === 'generated' ? 'generated' : 'uploaded',
        title: row.title ? String(row.title) : null,
        content: row.content ? String(row.content) : null,
        file_path: row.file_path ? String(row.file_path) : null,
        file_name: row.file_name ? String(row.file_name) : null,
        created_at: String(row.created_at || new Date().toISOString()),
      })) as ReportCardRow[];

      setStudents(studentRows);
  setClasses(classRows);
      setReportCards(reportRows);
    } catch (fetchError: any) {
      setError(String(fetchError?.message || 'Failed to load report card data.'));
    } finally {
      setIsLoadingBase(false);
    }
  };

  useEffect(() => {
    void fetchBaseData();
  }, []);

  useEffect(() => {
    const loadStudentClasses = async () => {
      if (!formData.student_id) {
        setAvailableClasses([]);
        return;
      }

      setIsLoadingStudentClasses(true);
      setError(null);

      try {
        let classIds: string[] = [];

        const primary = await supabase
          .from('class_course_students')
          .select('class_id')
          .eq('student_id', formData.student_id);

        if (!primary.error) {
          classIds = Array.from(new Set((primary.data || []).map((row: any) => String(row.class_id || '')).filter(Boolean)));
        } else if (isSchemaMissing(primary.error.message)) {
          const fallback = await supabase
            .from('student_courses')
            .select('course_id')
            .eq('student_id', formData.student_id);

          if (fallback.error) throw fallback.error;

          const courseIds = Array.from(new Set((fallback.data || []).map((row: any) => String(row.course_id || '')).filter(Boolean)));
          if (!courseIds.length) {
            setAvailableClasses([]);
            setFormData(prev => ({ ...prev, class_id: '' }));
            return;
          }

          const courseRows = await supabase
            .from('class_courses')
            .select('class_id')
            .in('id', courseIds);

          if (courseRows.error) throw courseRows.error;
          classIds = Array.from(new Set((courseRows.data || []).map((row: any) => String(row.class_id || '')).filter(Boolean)));
        } else {
          throw primary.error;
        }

        if (!classIds.length) {
          setAvailableClasses([]);
          setFormData(prev => ({ ...prev, class_id: '' }));
          return;
        }

        const filteredClasses = classes.filter((row) => classIds.includes(String(row.id)));
        setAvailableClasses(filteredClasses);

        setFormData(prev => {
          if (!prev.class_id) return prev;
          if (filteredClasses.some(item => String(item.id) === String(prev.class_id))) return prev;
          return { ...prev, class_id: '' };
        });
      } catch (loadError: any) {
        setAvailableClasses([]);
        setFormData(prev => ({ ...prev, class_id: '' }));
        setError(String(loadError?.message || 'Failed to load student classes.'));
      } finally {
        setIsLoadingStudentClasses(false);
      }
    };

    void loadStudentClasses();
  }, [formData.student_id, classes]);

  const deleteStorageFileIfExists = async (pathOrUrl: string | null) => {
    const storagePath = extractStoragePath(pathOrUrl);
    if (!storagePath) return;
    const { error: removeError } = await supabase.storage
      .from(REPORT_CARD_BUCKET)
      .remove([storagePath]);

    if (removeError) {
      console.warn('Failed to remove report card storage object:', removeError.message);
    }
  };

  const uploadPdfFile = async (studentId: string, file: File) => {
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed.');
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      throw new Error('PDF file is too large. Maximum size is 15MB.');
    }

    const cleanName = sanitizeFileName(file.name);
    const filePath = `${studentId}/${Date.now()}-${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from(REPORT_CARD_BUCKET)
      .upload(filePath, file, {
        upsert: false,
        contentType: 'application/pdf',
      });

    if (uploadError) throw uploadError;

    return {
      filePath,
      fileName: cleanName,
    };
  };

  const createGeneratedPdfFile = async () => {
    const studentName = studentMap.get(formData.student_id) || 'Student';
    const reportTitle = formData.title.trim() || 'Student Report';
    const reportContent = formData.content.trim();

    if (!reportContent) {
      throw new Error('Report content is required to create a report card.');
    }

    const blob = renderReportPdfBlob({
      studentName,
      reportDate: formData.report_date || getTodayIso(),
      title: reportTitle,
      content: reportContent,
    });

    const generatedFileName = sanitizeFileName(`${reportTitle.replace(/\s+/g, '-').toLowerCase() || 'student-report'}.pdf`);
    const filePath = `${formData.student_id}/${Date.now()}-${generatedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(REPORT_CARD_BUCKET)
      .upload(filePath, blob, {
        upsert: false,
        contentType: 'application/pdf',
      });

    if (uploadError) throw uploadError;

    return {
      filePath,
      fileName: generatedFileName,
      reportTitle,
      reportContent,
    };
  };

  // ── Template helpers ─────────────────────────────────────────────────────

  const analyzeTemplateWhiteSpaces = (img: HTMLImageElement): TextBox[] => {
    const MAX_DIM = 1000;
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const W = Math.round(img.naturalWidth * scale);
    const H = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);
    const isLight = (px: number, py: number) => {
      const i = (py * W + px) * 4;
      return data[i] > 215 && data[i + 1] > 215 && data[i + 2] > 215;
    };
    const rowLightRatio = (py: number) => {
      let w = 0;
      for (let x = 0; x < W; x += 2) if (isLight(x, py)) w++;
      return w / Math.ceil(W / 2);
    };
    const bands: Array<{ start: number; end: number }> = [];
    let bs = -1;
    for (let y = 0; y < H; y++) {
      if (rowLightRatio(y) >= 0.80) {
        if (bs === -1) bs = y;
      } else if (bs !== -1) {
        if (y - bs >= 16) bands.push({ start: bs, end: y });
        bs = -1;
      }
    }
    if (bs !== -1 && H - bs >= 16) bands.push({ start: bs, end: H });
    const found: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const band of bands) {
      const midY = Math.floor((band.start + band.end) / 2);
      let best = { start: 0, len: 0 }, cur = -1;
      for (let x = 0; x < W; x++) {
        if (isLight(x, midY)) {
          if (cur === -1) cur = x;
        } else if (cur !== -1) {
          if (x - cur > best.len) best = { start: cur, len: x - cur };
          cur = -1;
        }
      }
      if (cur !== -1 && W - cur > best.len) best = { start: cur, len: W - cur };
      if (best.len < W * 0.10) continue;
      found.push({ x: best.start, y: band.start, w: best.len, h: band.end - band.start });
    }
    return found
      .sort((a, b) => b.w * b.h - a.w * a.h)
      .slice(0, 14)
      .sort((a, b) => a.y - b.y)
      .map((r, i) => ({
        id: `tb-auto-${Date.now()}-${i}`,
        xPct: r.x / W,
        yPct: r.y / H,
        wPct: r.w / W,
        hPct: Math.max(r.h / H, 0.035),
        text: '',
        label: `Field ${i + 1}`,
      }));
  };

  const handleTemplateFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const isPdf = file.type === 'application/pdf' || ext === '.pdf';
    const isImg = /^image\/(jpeg|png)$/i.test(file.type) || ['.jpg', '.jpeg', '.png'].includes(ext);
    if (!isPdf && !isImg) { setError('Please select a PDF, JPEG, JPG or PNG file.'); return; }
    if (templateObjectUrl) URL.revokeObjectURL(templateObjectUrl);
    const url = URL.createObjectURL(file);
    setTemplateFile(file);
    setTemplateObjectUrl(url);
    setTemplateFileType(isPdf ? 'pdf' : 'image');
    setTextBoxes([]);
    setNaturalDims(null);
    setError(null);
    if (isImg) {
      setIsAnalyzingTemplate(true);
      const img = new Image();
      img.onload = () => {
        setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
        setTextBoxes(analyzeTemplateWhiteSpaces(img));
        setIsAnalyzingTemplate(false);
      };
      img.onerror = () => setIsAnalyzingTemplate(false);
      img.src = url;
    }
  };

  const renderTemplatePdfBlob = (
    imgUrl: string,
    boxes: TextBox[],
    natW: number,
    natH: number,
  ): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const MAX_PX = 2048;
        const sc = Math.min(1, MAX_PX / Math.max(natW, natH));
        const cvs = document.createElement('canvas');
        cvs.width = Math.round(natW * sc);
        cvs.height = Math.round(natH * sc);
        const ctx2 = cvs.getContext('2d');
        if (!ctx2) { reject(new Error('Canvas unavailable')); return; }
        ctx2.drawImage(img, 0, 0, cvs.width, cvs.height);
        const dataUrl = cvs.toDataURL('image/jpeg', 0.90);
        const aspect = natW / natH;
        const ptW = aspect >= 1 ? 841.89 : 595.28;
        const ptH = aspect >= 1 ? ptW / aspect : 841.89;
        const doc = new jsPDF({ unit: 'pt', format: [ptW, ptH] });
        doc.addImage(dataUrl, 'JPEG', 0, 0, ptW, ptH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        for (const box of boxes) {
          const txt = box.text.trim();
          if (!txt) continue;
          const bx = box.xPct * ptW + 3;
          const by = (box.yPct + box.hPct * 0.65) * ptH;
          doc.text(doc.splitTextToSize(txt, box.wPct * ptW - 6), bx, by);
        }
        resolve(doc.output('blob'));
      };
      img.onerror = () => reject(new Error('Failed to load template image.'));
      img.src = imgUrl;
    });

  const handleExportDraftPdf = () => {
    if (!formData.student_id) {
      setError('Select a student first.');
      return;
    }

    const reportTitle = formData.title.trim() || 'Student Report';
    const reportContent = formData.content.trim();
    if (!reportContent) {
      setError('Write report content before exporting draft PDF.');
      return;
    }

    const studentName = studentMap.get(formData.student_id) || 'Student';
    const blob = renderReportPdfBlob({
      studentName,
      reportDate: formData.report_date || getTodayIso(),
      title: reportTitle,
      content: reportContent,
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sanitizeFileName(reportTitle.replace(/\s+/g, '-').toLowerCase() || 'student-report')}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      student_id: '',
      class_id: '',
      report_date: getTodayIso(),
      title: '',
      content: '',
    });
    setAvailableClasses([]);
    setSelectedFile(null);
    setMode('upload');
    if (templateObjectUrl) URL.revokeObjectURL(templateObjectUrl);
    setTemplateFile(null);
    setTemplateObjectUrl(null);
    setTemplateFileType(null);
    setTextBoxes([]);
    setNaturalDims(null);
    setIsAnalyzingTemplate(false);
    setDraggingBoxId(null);
  };

  const openConfirmDialog = (message: string, action: () => Promise<void> | void) => {
    setConfirmDialog({
      message,
      onConfirm: async () => {
        setIsConfirmActionSubmitting(true);
        try {
          await action();
          setConfirmDialog(null);
        } finally {
          setIsConfirmActionSubmitting(false);
        }
      },
    });
  };

  const handleCreateReportCard = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.student_id) {
      setError('Student is required.');
      return;
    }

    if (!formData.class_id) {
      setError('Class is required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const { schoolId } = await getCurrentTenantContext();
      let uploadResult: { filePath: string; fileName: string };
      let reportTitle: string | null = null;
      let reportContent: string | null = null;

      if (mode === 'upload') {
        if (!selectedFile) {
          throw new Error('Please select a PDF file to upload.');
        }
        uploadResult = await uploadPdfFile(formData.student_id, selectedFile);
      } else if (mode === 'create') {
        const generated = await createGeneratedPdfFile();
        uploadResult = {
          filePath: generated.filePath,
          fileName: generated.fileName,
        };
        reportTitle = generated.reportTitle;
        reportContent = generated.reportContent;
      } else {
        // template mode
        if (!templateFile || !templateObjectUrl) {
          throw new Error('Please select a template file.');
        }
        if (templateFileType === 'image' && naturalDims) {
          const blob = await renderTemplatePdfBlob(
            templateObjectUrl, textBoxes, naturalDims.width, naturalDims.height,
          );
          const cleanName = sanitizeFileName(
            templateFile.name.replace(/\.[^.]+$/, '') + '-filled.pdf',
          );
          const filePath = `${formData.student_id}/${Date.now()}-${cleanName}`;
          const { error: uploadErr } = await supabase.storage
            .from(REPORT_CARD_BUCKET)
            .upload(filePath, blob, { upsert: false, contentType: 'application/pdf' });
          if (uploadErr) throw uploadErr;
          uploadResult = { filePath, fileName: cleanName };
        } else {
          if (templateFile.size > MAX_PDF_SIZE_BYTES)
            throw new Error('Template file is too large. Maximum 15MB.');
          const cleanName = sanitizeFileName(templateFile.name);
          const filePath = `${formData.student_id}/${Date.now()}-${cleanName}`;
          const { error: uploadErr } = await supabase.storage
            .from(REPORT_CARD_BUCKET)
            .upload(filePath, templateFile, { upsert: false, contentType: 'application/pdf' });
          if (uploadErr) throw uploadErr;
          uploadResult = { filePath, fileName: cleanName };
        }
      }

      const payload = withSchoolId({
        student_id: formData.student_id,
        class_id: formData.class_id,
        report_date: formData.report_date || getTodayIso(),
        report_type: mode === 'upload' ? 'uploaded' : 'generated',
        title: reportTitle,
        content: reportContent,
        file_path: uploadResult.filePath,
        file_name: uploadResult.fileName,
      }, schoolId);

      const insertResult = await supabase.from('report_cards').insert([payload]);
      if (insertResult.error && isSchemaMissing(insertResult.error.message)) {
        const { class_id: ignoredClassId, ...payloadWithoutClassId } = payload;
        const fallbackResult = await supabase.from('report_cards').insert([payloadWithoutClassId]);
        if (fallbackResult.error) {
          await deleteStorageFileIfExists(uploadResult.filePath);
          throw fallbackResult.error;
        }
      } else if (insertResult.error) {
        await deleteStorageFileIfExists(uploadResult.filePath);
        throw insertResult.error;
      }

      setStatus('Report card created successfully.');
      resetForm();
      await fetchBaseData();
    } catch (saveError: any) {
      setError(String(saveError?.message || 'Failed to create report card.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReportCard = async (id: string) => {
    const target = reportCards.find((item) => item.id === id) || null;
    if (!target) return;

    setIsDeletingId(id);
    setError(null);
    setStatus(null);

    try {
      const { error: deleteError } = await supabase
        .from('report_cards')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await deleteStorageFileIfExists(target.file_path);
      setReportCards((prev) => prev.filter((item) => item.id !== id));
      setStatus('Report card deleted successfully.');
    } catch (deleteErr: any) {
      setError(String(deleteErr?.message || 'Failed to delete report card.'));
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleDownloadPdf = async (row: ReportCardRow) => {
    if (!row.file_path) {
      setError('No PDF file is linked to this report card.');
      return;
    }

    setError(null);
    const path = extractStoragePath(row.file_path);
    if (!path) {
      setError('Invalid report PDF path.');
      return;
    }

    const { data, error: downloadError } = await supabase.storage
      .from(REPORT_CARD_BUCKET)
      .download(path);

    if (downloadError || !data) {
      setError(String(downloadError?.message || 'Failed to download PDF file.'));
      return;
    }

    const fileName = row.file_name?.trim() || `report-card-${row.id}.pdf`;
    const objectUrl = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const handleReplaceFile = async (row: ReportCardRow, file: File) => {
    setError(null);
    setStatus(null);

    try {
      const uploaded = await uploadPdfFile(row.student_id, file);

      const { error: updateError } = await supabase
        .from('report_cards')
        .update({
          report_type: 'uploaded',
          title: null,
          content: null,
          file_path: uploaded.filePath,
          file_name: uploaded.fileName,
        })
        .eq('id', row.id);

      if (updateError) {
        await deleteStorageFileIfExists(uploaded.filePath);
        throw updateError;
      }

      await deleteStorageFileIfExists(row.file_path);
      setStatus('Uploaded PDF changed successfully.');
      await fetchBaseData();
    } catch (replaceError: any) {
      setError(String(replaceError?.message || 'Failed to replace PDF file.'));
    }
  };

  const handleRemovePdfOnly = async (row: ReportCardRow) => {
    setError(null);
    setStatus(null);
    try {
      const { error: updateError } = await supabase
        .from('report_cards')
        .update({ file_path: null, file_name: null })
        .eq('id', row.id);

      if (updateError) throw updateError;

      await deleteStorageFileIfExists(row.file_path);
      setStatus('Uploaded PDF removed successfully.');
      await fetchBaseData();
    } catch (removeError: any) {
      setError(String(removeError?.message || 'Failed to remove PDF file.'));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tighter">Report Cards</h2>
        <p className="text-slate-500 mt-2 text-sm">Upload student PDF reports or create a report card and export it as PDF.</p>
      </div>

      <form onSubmit={handleCreateReportCard} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-premium space-y-6">
        <h3 className="text-lg font-black tracking-tight">Create Report Card</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Student</span>
            <select
              value={formData.student_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, student_id: event.target.value, class_id: '' }))}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              required
              disabled={isLoadingBase || isSaving}
            >
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Class</span>
            <select
              value={formData.class_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, class_id: event.target.value }))}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              required
              disabled={!formData.student_id || isLoadingStudentClasses || isSaving}
            >
              <option value="">{isLoadingStudentClasses ? 'Loading classes...' : 'Select class'}</option>
              {availableClasses.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Report Date</span>
            <input
              type="date"
              value={formData.report_date}
              onChange={(event) => setFormData((prev) => ({ ...prev, report_date: event.target.value }))}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              required
              disabled={isSaving}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-wider border ${mode === 'upload' ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            Upload file
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-wider border ${mode === 'create' ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            Create report card
          </button>
          <button
            type="button"
            onClick={() => setMode('template')}
            className={`px-4 py-3 rounded-2xl text-sm font-black uppercase tracking-wider border ${mode === 'template' ? 'bg-brand-500 text-white border-brand-500' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
          >
            Import a template
          </button>
        </div>

        {mode === 'upload' && (
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Upload File (PDF)</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
              disabled={isSaving}
            />
            {selectedFile && <p className="text-xs font-semibold text-slate-500">Selected: {selectedFile.name}</p>}
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <label className="space-y-2 block">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Report Title</span>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Monthly Student Progress"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
                disabled={isSaving}
              />
            </label>
            <label className="space-y-2 block">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Report Content</span>
              <textarea
                value={formData.content}
                onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Write the student report details..."
                rows={7}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold resize-y"
                disabled={isSaving}
              />
            </label>
            <button
              type="button"
              onClick={handleExportDraftPdf}
              className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider"
              disabled={isSaving}
            >
              Export Draft PDF
            </button>
          </div>
        )}

        {mode === 'template' && (
          <div className="space-y-4">
            {/* File picker */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Template File (PDF · JPEG · JPG · PNG)</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => templateFileInputRef.current?.click()}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider"
                >
                  {templateFile ? 'Change Template' : 'Select Template'}
                </button>
                {templateFile && (
                  <span className="text-xs font-semibold text-slate-500 truncate max-w-[220px]">{templateFile.name}</span>
                )}
              </div>
              <input
                ref={templateFileInputRef}
                type="file"
                accept="application/pdf,.pdf,image/jpeg,image/png,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleTemplateFileChange}
              />
            </div>

            {isAnalyzingTemplate && (
              <p className="text-xs font-semibold text-brand-500 animate-pulse">Scanning template for white spaces…</p>
            )}

            {/* Image template editor */}
            {templateFile && templateFileType === 'image' && templateObjectUrl && !isAnalyzingTemplate && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                    Template Editor
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        if (!templateObjectUrl) return;
                        setIsAnalyzingTemplate(true);
                        const ri = new Image();
                        ri.onload = () => { setTextBoxes(analyzeTemplateWhiteSpaces(ri)); setIsAnalyzingTemplate(false); };
                        ri.onerror = () => setIsAnalyzingTemplate(false);
                        ri.src = templateObjectUrl;
                      }}
                      className="px-3 py-1.5 rounded-xl bg-brand-50 text-brand-600 text-[10px] font-black uppercase tracking-widest"
                    >
                      Re-scan
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setTextBoxes([])}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Click anywhere on the template to add a text area.
                </p>

                {/* Template canvas with text box overlays */}
                <div
                  ref={templateContainerRef}
                  className="relative rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden select-none"
                  onMouseMove={(e) => {
                    if (!draggingBoxId || !templateContainerRef.current) return;
                    const r = templateContainerRef.current.getBoundingClientRect();
                    setTextBoxes(prev => prev.map(b =>
                      b.id !== draggingBoxId ? b : {
                        ...b,
                        xPct: Math.max(0, Math.min(1 - b.wPct, (e.clientX - r.left - dragOffset.x) / r.width)),
                        yPct: Math.max(0, Math.min(1 - b.hPct, (e.clientY - r.top - dragOffset.y) / r.height)),
                      }
                    ));
                  }}
                  onMouseUp={() => setDraggingBoxId(null)}
                  onMouseLeave={() => setDraggingBoxId(null)}
                >
                  <img
                    src={templateObjectUrl}
                    alt="Report template"
                    className="w-full h-auto block pointer-events-none"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                  />
                  {/* Transparent click-to-add overlay */}
                  <div
                    className="absolute inset-0 cursor-crosshair"
                    style={{ zIndex: 1 }}
                    onClick={(e) => {
                      if (draggingBoxId || !templateContainerRef.current) return;
                      const r = templateContainerRef.current.getBoundingClientRect();
                      const xPct = (e.clientX - r.left) / r.width;
                      const yPct = (e.clientY - r.top) / r.height;
                      setTextBoxes(prev => [...prev, {
                        id: `tb-${Date.now()}`,
                        xPct: Math.max(0, Math.min(0.7, xPct - 0.15)),
                        yPct: Math.max(0, Math.min(0.95, yPct - 0.025)),
                        wPct: 0.30,
                        hPct: 0.05,
                        text: '',
                        label: `Field ${prev.length + 1}`,
                      }]);
                    }}
                  />
                  {/* Text boxes */}
                  {textBoxes.map(box => (
                    <div
                      key={box.id}
                      style={{
                        position: 'absolute',
                        left: `${box.xPct * 100}%`,
                        top: `${box.yPct * 100}%`,
                        width: `${box.wPct * 100}%`,
                        zIndex: 10,
                      }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={box.text}
                        onChange={e => setTextBoxes(prev => prev.map(b => b.id === box.id ? { ...b, text: e.target.value } : b))}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        rows={2}
                        className="w-full bg-transparent text-sm font-medium p-1 outline-none resize-none block border-none"
                        placeholder="Enter text..."
                        disabled={isSaving}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PDF template – display-only + manual fields */}
            {templateFile && templateFileType === 'pdf' && templateObjectUrl && (
              <div className="space-y-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">PDF Template Preview</p>
                <p className="text-xs text-amber-600 font-semibold bg-amber-50 rounded-xl px-3 py-2">
                  PDF templates are shown for reference only. Add text fields below — they will be rendered as a separate overlay PDF alongside the original.
                </p>
                <iframe
                  src={templateObjectUrl}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700"
                  style={{ height: '560px' }}
                  title="PDF Template Preview"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{textBoxes.length} Text Field{textBoxes.length !== 1 ? 's' : ''}</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setTextBoxes(prev => [...prev, {
                        id: `tb-${Date.now()}`,
                        xPct: 0.05, yPct: 0.05 + 0.06 * prev.length,
                        wPct: 0.6, hPct: 0.04,
                        text: '', label: `Field ${prev.length + 1}`,
                      }])}
                      className="px-3 py-1.5 rounded-xl bg-brand-500 text-white text-[10px] font-black uppercase tracking-widest"
                    >
                      Add Field
                    </button>
                    {textBoxes.length > 0 && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setTextBoxes([])}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                {textBoxes.map(box => (
                  <div key={box.id} className="flex items-center gap-2">
                    <input
                      value={box.text}
                      onChange={e => setTextBoxes(prev => prev.map(b => b.id === box.id ? { ...b, text: e.target.value } : b))}
                      className="flex-1 px-3 py-2 rounded-xl bg-transparent border-none text-sm font-medium outline-none"
                      placeholder="Enter text..."
                      disabled={isSaving}
                    />
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setTextBoxes(prev => prev.filter(b => b.id !== box.id))}
                      className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center text-sm font-bold"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetForm}
            disabled={isSaving}
            className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black text-sm uppercase tracking-wider disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || isLoadingBase}
            className="px-6 py-3 rounded-2xl bg-brand-500 text-white font-black text-sm uppercase tracking-wider disabled:opacity-50"
          >
            {isSaving ? 'Creating...' : 'Create Report Card'}
          </button>
        </div>
      </form>

      {(error || status) && (
        <div className={`rounded-2xl px-5 py-3 text-sm font-semibold ${error ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {error || status}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-premium overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-black tracking-tight">Student Reports</h3>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{reportCards.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/60 dark:bg-slate-800/40">
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-black text-slate-400">Student</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-black text-slate-400">Class</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-black text-slate-400">Date</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-black text-slate-400">Type</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-black text-slate-400">File</th>
                <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-black text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reportCards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">No report cards found.</td>
                </tr>
              ) : reportCards.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold">{studentMap.get(item.student_id) || item.student_id}</td>
                  <td className="px-6 py-4">{item.class_id ? (classMap.get(item.class_id) || item.class_id) : '—'}</td>
                  <td className="px-6 py-4">{new Date(item.report_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-600">
                      {item.report_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">{item.file_name || 'No file'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDownloadPdf(item)}
                        disabled={!item.file_path}
                        className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs disabled:opacity-40"
                      >
                        Export PDF
                      </button>

                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        ref={(element) => {
                          replaceInputRefs.current[item.id] = element;
                        }}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = '';
                          if (!file) return;
                          void handleReplaceFile(item, file);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => replaceInputRefs.current[item.id]?.click()}
                        className="px-3 py-2 rounded-xl bg-sky-50 text-sky-700 font-bold text-xs"
                      >
                        Change File
                      </button>

                      <button
                        type="button"
                        onClick={() => openConfirmDialog('Are you sure you want to delete this uploaded file?', () => handleRemovePdfOnly(item))}
                        disabled={!item.file_path}
                        className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs disabled:opacity-40"
                      >
                        Delete File
                      </button>

                      <button
                        type="button"
                        onClick={() => openConfirmDialog('Are you sure you want to delete this report card?', () => handleDeleteReportCard(item.id))}
                        disabled={isDeletingId === item.id}
                        className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs disabled:opacity-50"
                      >
                        {isDeletingId === item.id ? 'Deleting...' : 'Delete Report'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-premium">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">Are you sure?</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">{confirmDialog.message}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDialog.onConfirm()}
                disabled={isConfirmActionSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-500 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-60"
              >
                {isConfirmActionSubmitting ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
