import { useLocation, Link } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-stone-950 text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-7xl font-light text-stone-600">404</h1>
        <p className="text-stone-300">The page <span className="font-medium text-white">"{pageName}"</span> doesn't exist.</p>
        <Link to="/" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-black">Go Home</Link>
      </div>
    </div>
  );
}
