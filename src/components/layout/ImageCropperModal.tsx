"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Point, Area } from "react-easy-crop";
import { X, Check } from "lucide-react";

interface ImageCropperModalProps {
  imageSrc: string;
  aspectRatio: number;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  // set canvas size to match the bounding box
  canvas.width = image.width;
  canvas.height = image.height;

  ctx.translate(image.width / 2, image.height / 2);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(data, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((file) => {
      resolve(file);
    }, "image/jpeg", 0.95);
  });
}

export function ImageCropperModal({ imageSrc, aspectRatio, onClose, onCropComplete }: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropChange = useCallback((crop: Point) => {
    setCrop(crop);
  }, []);

  const onCropCompleteHandler = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (blob) {
        onCropComplete(blob);
      } else {
        alert("Failed to crop image.");
      }
    } catch (e) {
      console.error(e);
      alert("Error cropping image.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-[#FAF8F5] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#4A154B]/10 bg-white">
          <h3 className="font-display font-bold text-[#4A154B] text-lg">Crop & Resize</h3>
          <button
            onClick={onClose}
            className="text-[#1A1A1A]/60 hover:text-[#1A1A1A] p-1 rounded-md hover:bg-black/5 transition"
            disabled={processing}
          >
            <X size={20} />
          </button>
        </div>

        {/* Cropper Body */}
        <div className="relative flex-1 bg-black min-h-[400px]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
            classes={{ containerClassName: "h-full w-full" }}
          />
        </div>

        {/* Controls & Footer */}
        <div className="bg-white p-6 border-t border-[#4A154B]/10 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Zoom Slider */}
            <div className="w-full max-w-xs flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#4A154B]/70">Zoom</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[#4A154B]"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                disabled={processing}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-[#4A154B]/20 text-[#4A154B] font-bold text-sm hover:bg-[#4A154B]/5 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={processing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#4A154B] text-white font-bold text-sm hover:opacity-90 shadow-lg transition disabled:opacity-50"
              >
                {processing ? (
                  "Processing..."
                ) : (
                  <>
                    <Check size={16} /> Save Crop
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
