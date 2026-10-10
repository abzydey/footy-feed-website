import { Link } from "react-router-dom";

import { useDocumentMeta } from "../lib/useDocumentMeta";

// Any URL no route matches. Before this existed an unknown path rendered an
// empty page that search engines would happily index as a real (blank)
// page; this says so plainly and is marked noindex.
export default function NotFoundPage() {
  useDocumentMeta({
    title: "Page not found",
    description: "This page doesn't exist on Full Set.",
    noindex: true,
  });

  return (
    <div className="max-w-2xl mx-auto p-4 pt-14 text-center">
      <h1 className="font-display italic font-black text-3xl text-white">Page not found</h1>
      <p className="mt-2 text-slate-400 text-sm">That page doesn't exist, or it's moved.</p>
      <div className="mt-5 flex justify-center gap-4 text-sm font-bold">
        <Link to="/" className="text-brand-violet hover:text-brand-hover">
          Home
        </Link>
        <Link to="/news" className="text-brand-violet hover:text-brand-hover">
          NRL News
        </Link>
        <Link to="/teams" className="text-brand-violet hover:text-brand-hover">
          Teams
        </Link>
      </div>
    </div>
  );
}
