export interface VideoDTO {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  file_size: string;
  original_filename: string;
  duration: number;
  views: number;
  like_count: number;
  save_count: number;
  created_at: string;
  liked?: boolean;
  saved?: boolean;
}

export interface UserDTO {
  id: string;
  ip_fingerprint: string;
  is_premium: boolean;
  created_at: string;
}

export interface WatchEventDTO {
  video_id: string;
  watch_time: number;
  completed: boolean;
}

/** Cursor-based paginated feed response */
export interface FeedResponse {
  videos: VideoDTO[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Session seed echoed back from the server for seeded random ordering. */
  seed?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface ApiError {
  error: string;
  code?: string;
}

export interface InteractionPayload {
  video_id: string;
  action: "like" | "unlike" | "save" | "unsave";
}

export interface WatchPayload {
  video_id: string;
  watch_time: number;
  completed: boolean;
}

export interface LikeResponse {
  liked: boolean;
  count: number;
}

export interface SaveResponse {
  saved: boolean;
  count: number;
}

export interface CommentDTO {
  id: string;
  body: string;
  created_at: string;
  author: string;
}

export interface AnalyticsDTO {
  video_id: string;
  total_views: number;
  avg_watch_time: number;
  completion_rate: number;
  views_per_day: { date: string; views: number }[];
}
