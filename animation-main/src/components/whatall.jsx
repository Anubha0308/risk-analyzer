import React from "react";
import MagicBento from "./MagicBento";

function Whatall() {
  return (
    <div className="min-h-screen w-screen bg-[#fafbfc] flex flex-col justify-center items-center py-4">
     <div className="w-full max-w-7xl px-6">
          <MagicBento
            textAutoHide={true}
            enableStars={true}
            enableSpotlight={true}
            enableBorderGlow={true}
            enableTilt={true}
            enableMagnetism={true}
            clickEffect={true}
            spotlightRadius={300}
            particleCount={12}
            glowColor="132, 0, 255"
          />
        </div>
    </div>
  );
}

export default Whatall;
