const UPDATE_CHECK = 'check_update';

export const check_app_update = (): Promise<boolean> => {
  const worker = navigator.serviceWorker?.controller ?? null;

  if (worker === null) {
    return Promise.resolve(false);
  }

  const channel = new MessageChannel();
  const reply = new Promise<boolean>(resolve => {
    channel.port1.onmessage = event => resolve(event.data === true);
  });

  worker.postMessage(UPDATE_CHECK, [channel.port2]);

  return reply;
};

export const restart_app = () => {
  location.reload();
};
