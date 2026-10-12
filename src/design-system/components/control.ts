/** Classes base dos campos de texto (Input, Textarea e editores). */
export const controlBase =
  "w-full rounded-md border bg-white text-body-sm text-neutral-900 placeholder:text-neutral-500 transition-[border-color,box-shadow] duration-150 focus:outline-none focus-visible:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400";

export function controlState(invalid?: boolean) {
  return invalid ? "border-red-500 focus:border-red-500 focus:ring-red-100" : "border-neutral-200 hover:border-neutral-300";
}
