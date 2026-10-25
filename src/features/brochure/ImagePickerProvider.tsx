import React, { createContext, useCallback, useContext, useState } from "react";
import type { Settings } from "../../domain/models";
import { CoverLogoPicker } from "./CoverLogoPicker";

export interface ImagePickerRequest {
  source?: string;
  title?: string;
  kind?: "logo" | "image";
  onSelect: (source: string) => void;
}

type ChooseImage = (request: ImagePickerRequest) => void;
const ImagePickerContext = createContext<ChooseImage | null>(null);

/** Returns null outside the brochure editor so standalone artwork keeps its upload fallback. */
export function useImagePicker() {
  return useContext(ImagePickerContext);
}

export function ImagePickerProvider({
  settings,
  children,
}: {
  settings?: Settings;
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<
    (ImagePickerRequest & { id: number }) | null
  >(null);
  const sequence = React.useRef(0);
  const choose = useCallback<ChooseImage>((next) => {
    setRequest({ ...next, id: ++sequence.current });
  }, []);
  return (
    <ImagePickerContext.Provider value={choose}>
      {children}
      {request && (
        <CoverLogoPicker
          key={request.id}
          settings={settings}
          currentSource={request.source}
          title={request.title}
          kind={request.kind}
          onSelect={request.onSelect}
          onClose={() => setRequest(null)}
        />
      )}
    </ImagePickerContext.Provider>
  );
}
