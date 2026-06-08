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

interface ReportCardPageProps {
  schoolId?: string | null;
}

export function useReportCard(schoolId: string | undefined | null) {
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
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false }),
      ]);

      if (studentsResult.error) throw studentsResult.error;
      if (classesResult.error) throw classesResult.error;

      let reportRowsData: any[] = [];
      {
        const primaryReportsResult = await supabase
          .from('report_cards')
          .select('id, student_id, class_id, report_date, report_type, title, content, file_path, file_name, created_at')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false });

        if (!primaryReportsResult.error) {
          reportRowsData = primaryReportsResult.data || [];
        } else if (isSchemaMissing(primaryReportsResult.error.message)) {
          const fallbackReportsResult = await supabase
            .from('report_cards')
            .select('id, student_id, report_date, report_type, title, content, file_path, file_name, created_at')
            .eq('school_id', schoolId)
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
          .eq('student_id', formData.student_id)
          .eq('school_id', schoolId);

        if (!primary.error) {
          classIds = Array.from(new Set((primary.data || []).map((row: any) => String(row.class_id || '')).filter(Boolean)));
        } else if (isSchemaMissing(primary.error.message)) {
          const fallback = await supabase
            .from('student_courses')
            .select('course_id')
            .eq('student_id', formData.student_id)
            .eq('school_id', schoolId);

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
            .in('id', courseIds)
            .eq('school_id', schoolId);

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
        .eq('id', id)
        .eq('school_id', schoolId);

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
        .eq('id', row.id)
        .eq('school_id', schoolId);

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
        .eq('id', row.id)
        .eq('school_id', schoolId);

      if (updateError) throw updateError;

      await deleteStorageFileIfExists(row.file_path);
      setStatus('Uploaded PDF removed successfully.');
      await fetchBaseData();
    } catch (removeError: any) {
      setError(String(removeError?.message || 'Failed to remove PDF file.'));
    }
  };

  return {
    students,
    setStudents,
    classes,
    setClasses,
    availableClasses,
    setAvailableClasses,
    reportCards,
    setReportCards,
    mode,
    setMode,
    isLoadingBase,
    setIsLoadingBase,
    isLoadingStudentClasses,
    setIsLoadingStudentClasses,
    isSaving,
    setIsSaving,
    isDeletingId,
    setIsDeletingId,
    isConfirmActionSubmitting,
    setIsConfirmActionSubmitting,
    error,
    setError,
    status,
    setStatus,
    confirmDialog,
    setConfirmDialog,
    formData,
    setFormData,
    selectedFile,
    setSelectedFile,
    replaceInputRefs,
    templateFile,
    setTemplateFile,
    templateObjectUrl,
    setTemplateObjectUrl,
    templateFileType,
    setTemplateFileType,
    isAnalyzingTemplate,
    setIsAnalyzingTemplate,
    naturalDims,
    setNaturalDims,
    textBoxes,
    setTextBoxes,
    draggingBoxId,
    setDraggingBoxId,
    dragOffset,
    setDragOffset,
    templateContainerRef,
    templateFileInputRef,
    studentMap,
    classMap,
    fetchBaseData,
    handleTemplateFileChange,
    handleExportDraftPdf,
    resetForm,
    openConfirmDialog,
    handleCreateReportCard,
    handleDeleteReportCard,
    handleDownloadPdf,
    handleReplaceFile,
    handleRemovePdfOnly
  };
}
