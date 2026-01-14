"use client";

import { useState, useEffect } from 'react';
import { WebPlayer } from '../components/WebPlayer';

export default function WatchPage() {
  const [currentContent, setCurrentContent] = useState({
    id: 1,
    title: "The Discovery: Season 2, Episode 3",
    videoUrl: "https://cdn.intuitv.app/streams/discovery-s2e3/playlist.m3u8",
    poster: "/api/placeholder/1920/1080"
  });

  return (
    <div className="min-h-screen bg-black">
      {/* Main Video Player */}
      <div className="w-full max-w-7xl mx-auto">
        <WebPlayer
          contentId={currentContent.id}
          videoUrl={currentContent.videoUrl}
          title={currentContent.title}
          poster={currentContent.poster}
          autoplay={false}
          onEnded={() => {
            console.log('Video ended, show next recommendation');
          }}
        />
      </div>

      {/* Recommendations Below */}
      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-white text-2xl font-bold mb-4">
          Up Next
        </h2>
        {/* Recommendation grid */}
      </div>
    </div>
  );
}
