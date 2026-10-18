const two = (value: number) => String(value).padStart(2, '0');

export const screenshot_name = (prefix: string) => {
  const date = new Date();

  return (
    `${prefix}-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}` +
    `_${two(date.getHours())}-${two(date.getMinutes())}-${two(date.getSeconds())}.png`
  );
};

export const download_canvas = (canvas: HTMLCanvasElement, filename: string) => {
  canvas.toBlob(blob => {
    if (blob === null) {
      console.warn('Screenshot failed: canvas is empty or too large');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
};
