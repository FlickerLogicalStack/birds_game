export type WorkerTask<TInput, TOutput> = {
  name: string;
  run: (input: TInput) => TOutput | Promise<TOutput>;
  transfer?: (output: TOutput) => Transferable[];
};

export type AnyTask = WorkerTask<any, any>;

export type TaskRequest = { id: number; name: string; input: unknown };
export type TaskResponse = { id: number; output?: unknown; error?: string };

export const define_task = <TInput, TOutput>(task: WorkerTask<TInput, TOutput>) => task;

export const serve_tasks = (tasks: readonly AnyTask[]) => {
  const by_name = new Map(tasks.map(task => [task.name, task]));

  self.onmessage = async (event: MessageEvent<TaskRequest>) => {
    const { id, name, input } = event.data;
    const task = by_name.get(name);

    if (!task) {
      self.postMessage({ id, error: `Unknown task "${name}"` } satisfies TaskResponse);
      return;
    }

    try {
      const output = await task.run(input);

      self.postMessage({ id, output } satisfies TaskResponse, {
        transfer: task.transfer?.(output) ?? [],
      });
    } catch (error) {
      self.postMessage({ id, error: String(error) } satisfies TaskResponse);
    }
  };
};
