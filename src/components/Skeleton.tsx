// src/components/Skeleton.tsx
interface SkeletonProps {
  width?:    string | number
  height?:   string | number
  radius?:   number
  className?: string
}

export default function Skeleton({ width, height, radius = 6, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width:        width  ?? '100%',
        height:       height ?? 16,
        borderRadius: radius,
        flexShrink:   0,
      }}
    />
  )
}
