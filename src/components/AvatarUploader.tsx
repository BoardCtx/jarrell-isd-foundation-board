'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { Camera, ZoomIn, ZoomOut, Upload, X, Loader2, RotateCcw } from 'lucide-react';
import Avatar from './Avatar';

interface AvatarUploaderProps {
  userId: string;
  currentAvatarUrl?: string | null;
  userName: string;
  onUploadComplete: (url: string) => void;
}

export default function AvatarUploader({
  userId,
  currentAvatarUrl,
  userName,
  onUploadComplete,
}: AvatarUploaderProps) {
  const supabase = createClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Transform state for crop/zoom/drag
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_SIZE = 256; // Final output size
  const PREVIEW_SIZE = 280; // Editor preview size

  // Draw the image onto the canvas with current transform
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;

    canvas.width = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE;

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Draw circular clip mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Fill background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Calculate image dimensions to fit/fill the circle
    const imgAspect = image.width / image.height;
    let drawWidth: number, drawHeight: number;

    if (imgAspect > 1) {
      // Landscape: fit height, overflow width
      drawHeight = PREVIEW_SIZE * scale;
      drawWidth = drawHeight * imgAspect;
    } else {
      // Portrait or square: fit width, overflow height
      drawWidth = PREVIEW_SIZE * scale;
      drawHeight = drawWidth / imgAspect;
    }

    const x = (PREVIEW_SIZE - drawWidth) / 2 + offsetX;
    const y = (PREVIEW_SIZE - drawHeight) / 2 + offsetY;

    ctx.drawImage(image, x, y, drawWidth, drawHeight);
    ctx.restore();

    // Draw circle border
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(PREVIEW_SIZE / 2, PREVIEW_SIZE / 2, PREVIEW_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }, [image, scale, offsetX, offsetY]);

  useEffect(() => {
    if (image && showEditor) {
      drawCanvas();
    }
  }, [image, showEditor, drawCanvas]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB.');
      return;
    }

    setError('');

    const img = new Image();
    img.onload = () => {
      setImage(img);
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      setShowEditor(true);
    };
    img.src = URL.createObjectURL(file);
  };

  // Mouse/touch drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setOffsetX(e.clientX - dragStart.x);
    setOffsetY(e.clientY - dragStart.y);
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.5));
  const handleReset = () => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleUpload = async () => {
    if (!image) return;

    setUploading(true);
    setError('');

    try {
      // Render final image at 256x256
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = CANVAS_SIZE;
      outputCanvas.height = CANVAS_SIZE;
      const ctx = outputCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // Scale factor from preview to output
      const ratio = CANVAS_SIZE / PREVIEW_SIZE;

      // Clip to circle
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();

      // Background
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Draw image with same transform, scaled down
      const imgAspect = image.width / image.height;
      let drawWidth: number, drawHeight: number;

      if (imgAspect > 1) {
        drawHeight = PREVIEW_SIZE * scale;
        drawWidth = drawHeight * imgAspect;
      } else {
        drawWidth = PREVIEW_SIZE * scale;
        drawHeight = drawWidth / imgAspect;
      }

      const x = ((PREVIEW_SIZE - drawWidth) / 2 + offsetX) * ratio;
      const y = ((PREVIEW_SIZE - drawHeight) / 2 + offsetY) * ratio;

      ctx.drawImage(image, x, y, drawWidth * ratio, drawHeight * ratio);

      // Convert to JPEG blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        outputCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to create image'))),
          'image/jpeg',
          0.85
        );
      });

      // Upload to Supabase Storage
      const fileName = `${Date.now()}.jpg`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Delete old avatar if it exists (clean up storage)
      if (currentAvatarUrl) {
        try {
          const oldPath = currentAvatarUrl.split('/avatars/')[1];
          if (oldPath) {
            await supabase.storage.from('avatars').remove([oldPath]);
          }
        } catch {
          // Non-critical — old file cleanup failure is fine
        }
      }

      onUploadComplete(publicUrl);
      setShowEditor(false);
      setImage(null);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setShowEditor(false);
    setImage(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      {/* Current Avatar + Upload Button */}
      {!showEditor && (
        <div className="flex items-center gap-4">
          <Avatar src={currentAvatarUrl} name={userName} size="lg" />
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Camera className="w-4 h-4" />
              {currentAvatarUrl ? 'Change Photo' : 'Upload Photo'}
            </button>
            <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or WebP. Max 2MB.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Crop/Zoom Editor */}
      {showEditor && image && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 font-medium">
            Drag to position, zoom to adjust. Your photo will be cropped to a circle.
          </p>

          {/* Canvas Preview */}
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              className="cursor-grab active:cursor-grabbing rounded-full"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-gray-700" />
            </button>

            <input
              type="range"
              min="50"
              max="300"
              value={scale * 100}
              onChange={(e) => setScale(Number(e.target.value) / 100)}
              className="w-40 accent-blue-600"
            />

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-gray-700" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4 text-gray-700" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={uploading}
              className="btn-secondary flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>

            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Save Avatar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
}
