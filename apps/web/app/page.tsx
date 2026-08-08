import { redirect } from 'next/navigation';

/** A raiz nao tem conteudo proprio: o middleware decide login ou dashboard. */
export default function HomePage() {
  redirect('/dashboard');
}
