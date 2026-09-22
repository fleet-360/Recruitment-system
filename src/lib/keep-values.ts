import { startTransition, type FormEvent } from "react";

// React 19 resets a <form action={…}> after every submit, so a server-side validation error wipes what
// the user typed (and unchecks controlled radios). Use <form onSubmit={keepValues(action)}> instead.
// New-item forms that should clear after a save remount with key={state?.savedAt}.
export const keepValues = (action: (data: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  startTransition(() => action(data));
};
