import { nanoid } from 'nanoid';

/** Short, URL-safe id for instruments / clips / sections. */
export const id = () => nanoid(10);
