import { Link } from "react-router-dom";

export default function NoAccess() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">You do not have access to this page</h1>
      <p className="mt-1 text-sm text-slate-500">Your role cannot open it. Ask an admin if you need access.</p>
      <Link to="/" className="mt-3 inline-block text-sm text-blue-700 underline">Back to the dashboard</Link>
    </div>
  );
}
