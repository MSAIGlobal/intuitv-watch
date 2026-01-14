const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.intuitv.app';

/* =========================
   Types
========================= */

export interface StreamInfo {
  stream_url: string;
  title: string;
  description: string;
  channel: string;
  thumbnail?: string;
  duration?: number;
  live: boolean;
}

export interface Recommendation {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  channel: string;
  views: number;
}

export interface ViewerStats {
  current_viewers: number;
  total_views: number;
  avg_watch_time: number;
  engagement_rate: number;
}

export interface WatchSession {
  session_id: string;
  content_id: string;
  start_time: number;
  last_heartbeat: number;
}

/* ✅ NEW: session metadata (fixes Netlify build error) */
export interface SessionMetadata {
  device_type: string;
  platform: string;
  browser: string;
  screen_resolution: string;
}

/* =========================
   Utils
========================= */

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/* =========================
   Client
========================= */

class WatchAnalyticsClient {
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T | null> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        console.warn(`Watch API warning: ${response.status} ${endpoint}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error(`Watch API error: ${endpoint}`, error);
      return null;
    }
  }

  /* =========================
     Streams
  ========================= */

  async getStreamInfo(contentId: string): Promise<StreamInfo | null> {
    const data = await this.fetch<StreamInfo>(`/watch/stream/${contentId}`);

    if (!data) {
      return {
        stream_url: 'https://cdn.intuitv.app/stream/demo.m3u8',
        title: 'IntuiTV Live Stream',
        description: 'AI-powered personalized television',
        channel: 'IntuiTV Main',
        live: true,
        thumbnail: 'https://cdn.intuitv.app/thumbs/live.jpg',
      };
    }

    return data;
  }

  /* =========================
     Recommendations
  ========================= */

  async getRecommendations(
    userId?: string,
    limit: number = 5
  ): Promise<Recommendation[]> {
    const endpoint = userId
      ? `/watch/recommendations?user_id=${userId}&limit=${limit}`
      : `/watch/recommendations?limit=${limit}`;

    const data = await this.fetch<Recommendation[]>(endpoint);
    if (!data) return this.getMockRecommendations(limit);

    return data;
  }

  /* =========================
     Viewer Stats
  ========================= */

  async getViewerStats(contentId: string): Promise<ViewerStats> {
    const data = await this.fetch<ViewerStats>(`/watch/stats/${contentId}`);

    if (!data) {
      return {
        current_viewers: Math.floor(10000 + Math.random() * 5000),
        total_views: Math.floor(500000 + Math.random() * 100000),
        avg_watch_time: 4.2 + Math.random() * 2,
        engagement_rate: 0.75 + Math.random() * 0.2,
      };
    }

    return data;
  }

  /* =========================
     Sessions (FIXED)
  ========================= */

  async startSession(
    contentId: string,
    sessionId: string,
    metadata?: SessionMetadata
  ): Promise<WatchSession | null> {
    const data = await this.fetch<WatchSession>('/watch/session/start', {
      method: 'POST',
      body: JSON.stringify({
        content_id: contentId,
        session_id: sessionId,
        metadata,
        timestamp: Date.now(),
      }),
    });

    if (!data) {
      return {
        session_id: sessionId,
        content_id: contentId,
        start_time: Date.now(),
        last_heartbeat: Date.now(),
      };
    }

    return data;
  }

  async sendHeartbeat(
    sessionId: string,
    currentTime: number
  ): Promise<boolean> {
    const data = await this.fetch<{ success: boolean }>(
      '/watch/session/heartbeat',
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          current_time: currentTime,
          timestamp: Date.now(),
        }),
      }
    );

    return data?.success || false;
  }

  async endSession(
    sessionId: string,
    watchTime: number
  ): Promise<boolean> {
    const data = await this.fetch<{ success: boolean }>(
      '/watch/session/end',
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          watch_time: watchTime,
          timestamp: Date.now(),
        }),
      }
    );

    return data?.success || false;
  }

  async recordInteraction(
    sessionId: string,
    action: 'like' | 'share' | 'comment'
  ): Promise<boolean> {
    const data = await this.fetch<{ success: boolean }>(
      '/watch/interaction',
      {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          action,
          timestamp: Date.now(),
        }),
      }
    );

    return data?.success || false;
  }

  /* =========================
     WebSocket
  ========================= */

  connectToLiveStats(
    contentId: string,
    onUpdate: (stats: ViewerStats) => void
  ): () => void {
    try {
      const ws = new WebSocket(
        `${API_URL.replace('http', 'ws')}/ws/watch/stats/${contentId}`
      );

      ws.onmessage = (event) => {
        try {
          const stats: ViewerStats = JSON.parse(event.data);
          onUpdate(stats);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      return () => {};
    }
  }

  /* =========================
     Mocks
  ========================= */

  private getMockRecommendations(limit: number): Recommendation[] {
    const titles = [
      'AI Generated Space Documentary',
      'Futuristic City Tour',
      'Ocean Wildlife Special',
      'Tech Innovation Series',
      'Cultural Heritage Journey',
      'Science Explained Simply',
      'Adventure Travel Show',
      'Music & Art Fusion',
    ];

    const channels = [
      'IntuiTV Docs',
      'IntuiTV Travel',
      'IntuiTV Science',
      'IntuiTV Culture',
      'IntuiTV Entertainment',
    ];

    return Array.from({ length: Math.min(limit, 8) }, (_, i) => ({
      id: `rec-${i}`,
      title: titles[i % titles.length],
      thumbnail: `https://cdn.intuitv.app/thumbs/rec-${i}.jpg`,
      duration: Math.floor(300 + Math.random() * 600),
      channel: channels[i % channels.length],
      views: Math.floor(10000 + Math.random() * 90000),
    }));
  }
}

/* =========================
   Export
========================= */

export const analyticsClient = new WatchAnalyticsClient();
