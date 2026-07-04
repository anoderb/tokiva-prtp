import { redirect } from 'next/navigation';

/**
 * Entry point page that redirects to the primary POS Kasir interface.
 */
export default function Home() {
  redirect('/kasir');
}
