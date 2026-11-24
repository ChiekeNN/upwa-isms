import { redirect } from "next/navigation";

/** Prototype mode: the public portal demo needs no account or password. */
export default function LoginPage() {
  redirect("/portal");
}
