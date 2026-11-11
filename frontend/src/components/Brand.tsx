import { Droplet } from 'lucide-react';
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark">
        <Droplet size={23} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span>
        Sweety<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
