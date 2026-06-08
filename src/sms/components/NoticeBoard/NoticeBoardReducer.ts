import { NoticeItem } from './types';

export type NoticeBoardState = {
  notices: NoticeItem[];
  isLoading: boolean;
  isSaving: boolean;
  deletingId: string | null;
  status: string | null;
  error: string | null;
  filterDate: string;
  filterPriority: 'all' | NoticeItem['priority'];
  confirmDialog: { message: string; onConfirm: () => void } | null;
  
  title: string;
  message: string;
  noticeDate: string;
  priority: NoticeItem['priority'];
  selectedFile: File | null;
};

export type NoticeBoardAction =
  | { type: 'SET_NOTICES'; payload: NoticeItem[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_DELETING_ID'; payload: string | null }
  | { type: 'SET_STATUS'; payload: string | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_FILTER_DATE'; payload: string }
  | { type: 'SET_FILTER_PRIORITY'; payload: 'all' | NoticeItem['priority'] }
  | { type: 'SET_CONFIRM_DIALOG'; payload: { message: string; onConfirm: () => void } | null }
  | { type: 'SET_FORM_FIELD'; field: keyof NoticeBoardState; value: any }
  | { type: 'RESET_FORM'; defaultDate: string }
  | { type: 'DELETE_NOTICE_SUCCESS'; id: string };

export function noticeBoardReducer(state: NoticeBoardState, action: NoticeBoardAction): NoticeBoardState {
  switch (action.type) {
    case 'SET_NOTICES': return { ...state, notices: action.payload };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_SAVING': return { ...state, isSaving: action.payload };
    case 'SET_DELETING_ID': return { ...state, deletingId: action.payload };
    case 'SET_STATUS': return { ...state, status: action.payload };
    case 'SET_ERROR': return { ...state, error: action.payload };
    case 'SET_FILTER_DATE': return { ...state, filterDate: action.payload };
    case 'SET_FILTER_PRIORITY': return { ...state, filterPriority: action.payload };
    case 'SET_CONFIRM_DIALOG': return { ...state, confirmDialog: action.payload };
    case 'SET_FORM_FIELD': return { ...state, [action.field]: action.value };
    case 'RESET_FORM':
      return {
        ...state, title: '', message: '', noticeDate: action.defaultDate, priority: 'medium', selectedFile: null
      };
    case 'DELETE_NOTICE_SUCCESS':
      return { ...state, notices: state.notices.filter((n) => n.id !== action.id) };
    default:
      return state;
  }
}
