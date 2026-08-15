import React, { useState } from 'react';
import { PaymentRecord, uploadPaymentReceipt } from '../services/smsService';
import {
  ArrowLeft, QrCode, Upload, FileText, CheckCircle2,
  ShieldCheck, AlertCircle, RefreshCw, Image as ImageIcon, Check
} from 'lucide-react';

interface PaymentCheckoutProps {
  payment: PaymentRecord | null;
  studentId?: string;
  schoolId?: string;
  onBack: () => void;
  onReceiptUploaded?: () => void;
}

const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({
  payment,
  studentId,
  schoolId,
  onBack,
  onReceiptUploaded,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(payment?.receipt_url || null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>(
    payment?.receipt_url ? 'success' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!payment) {
    return (
      <div className="text-center py-20 bg-white rounded-[2rem] p-8 border border-slate-100 max-w-lg mx-auto space-y-4">
        <AlertCircle className="w-16 h-16 text-amber-500 mx-auto" />
        <h3 className="text-lg font-black text-slate-900 uppercase">No Pending Payment Selected</h3>
        <p className="text-xs text-slate-500">Please select a pending fee record from your Finance overview.</p>
        <button type="button" onClick={onBack} className="px-6 py-3 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-600 transition-all">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const amount = payment.amount;
  const description = payment.description || 'Institutional Fee';
  const paymentId = payment.id;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);

      // Generate local preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a receipt image or document to upload.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    const result = await uploadPaymentReceipt(
      selectedFile,
      paymentId,
      studentId || 'unknown',
      schoolId
    );

    setUploading(false);

    if (result.success) {
      setUploadStatus('success');
      if (result.url) {
        setPreviewUrl(result.url);
      }
      if (onReceiptUploaded) {
        onReceiptUploaded();
      }
    } else {
      setUploadStatus('error');
      setErrorMessage(result.error || 'Failed to upload receipt proof. Please try again.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 max-w-5xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="bg-white border border-slate-100 px-4 py-2.5 rounded-2xl text-slate-700 hover:text-emerald-700 hover:border-emerald-200 transition-all shadow-sm flex items-center gap-2 text-xs font-black uppercase tracking-widest active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> AES-256 Encrypted Payment
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Code & Payment Summary (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Invoice Summary Card */}
          <div className="bg-white p-6 sm:p-7 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Invoice Reference</span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase mt-0.5">{description}</h2>
              </div>
              <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest ${
                payment?.status === 'Paid' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {payment?.status || 'Pending'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student ID</p>
                <p className="font-black text-slate-800 text-sm mt-0.5">{studentId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment ID</p>
                <p className="font-black text-slate-800 text-sm mt-0.5 truncate">{paymentId}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Total Amount Due</p>
                <p className="text-3xl font-black text-white tracking-tight mt-0.5">${amount.toFixed(2)}</p>
              </div>
              <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-2.5 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="bg-white p-6 sm:p-7 rounded-[2rem] shadow-sm border border-slate-100 text-center flex flex-col items-center">
            <div className="bg-emerald-50 text-emerald-600 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-3">
              <QrCode className="w-3.5 h-3.5" /> Express QR Scan
            </div>

            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Scan QR Code to Pay</h3>
            <p className="text-xs text-slate-500 max-w-sm font-medium mt-1 mb-4">
              Open your KBZPay, CB Pay, AYA Pay, WavePay, or Mobile Banking app to scan and execute instant transfer.
            </p>

            <div className="bg-emerald-50/50 p-4 rounded-3xl border-2 border-dashed border-emerald-200 inline-block mb-4 shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=IEM_PAY_${paymentId}_${amount}&color=059669`}
                alt="Payment QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl object-contain bg-white p-2 shadow-inner"
              />
            </div>

            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Please take a screenshot of your transfer receipt after payment
            </p>
          </div>
        </div>

        {/* Right Column: Upload Receipt Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 sm:p-7 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">Upload Payment Receipt</h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mb-5">
                Upload your transfer receipt screenshot or document so our finance department can verify your payment.
              </p>

              {/* Upload Dropzone */}
              <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group block text-center mb-4">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:scale-110 transition-all mb-3">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  {selectedFile ? selectedFile.name : 'Click to select receipt file'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                  Supports PNG, JPG, JPEG, PDF (Max 5MB)
                </p>
              </label>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-rose-50 text-rose-700 border border-rose-100 p-3 rounded-xl text-xs font-bold flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Preview Box */}
              {previewUrl && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl space-y-2 mb-4">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <span>Receipt Preview</span>
                    {uploadStatus === 'success' && (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Submitted
                      </span>
                    )}
                  </div>
                  {previewUrl.startsWith('data:image') || previewUrl.startsWith('http') ? (
                    <img
                      src={previewUrl}
                      alt="Receipt Preview"
                      className="max-h-48 w-full object-contain rounded-xl bg-white border border-slate-200"
                    />
                  ) : (
                    <div className="p-4 bg-white rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      <span className="truncate">{selectedFile?.name || 'Uploaded Document'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Success Notification */}
              {uploadStatus === 'success' && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-2xl space-y-1 mb-4">
                  <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Proof Submitted Successfully!
                  </div>
                  <p className="text-[11px] font-medium text-emerald-600">
                    Your receipt has been submitted and is currently <strong>Pending Verification</strong> by our accounting team.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={uploading || !selectedFile}
                className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Uploading Receipt…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Submit Proof of Payment
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onBack}
                className="w-full py-3.5 bg-slate-100 text-slate-700 font-black rounded-2xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckout;
