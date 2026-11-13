import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <Link to="/" className="mt-3 inline-block text-sm text-blue-700 underline">Back to the dashboard</Link>
      </div>
    </div>
  );
}
