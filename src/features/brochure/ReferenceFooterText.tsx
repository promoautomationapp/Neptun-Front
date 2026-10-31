import React from "react";

/** Keep the whole sentence editable; emphasis never changes the saved wording. */
export function ReferenceFooterPayment({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\d+\s+këste|0%\s+interes\.?)/gi)
        .map((part, index) =>
          /^(?:\d+\s+këste|0%\s+interes\.?)$/i.test(part) ? (
            <strong key={index}>{part}</strong>
          ) : (
            <React.Fragment key={index}>{part}</React.Fragment>
          ),
        )}
    </>
  );
}

export function ReferenceFooterValidity({ text }: { text: string }) {
  const location = text.search(/,\s*n[ëe]\s+dyqane\s+dhe\s+online\.?$/i);
  if (!/^Vlen\s/i.test(text)) return <>{text}</>;
  return location < 0 ? (
    <strong>{text}</strong>
  ) : (
    <>
      <strong>{text.slice(0, location + 1)}</strong>
      {text.slice(location + 1)}
    </>
  );
}
