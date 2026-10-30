import { IMAGES } from '../lib/images.js'

const base = `${import.meta.env.BASE_URL}images/`

// A licensed photo from public/images, as WebP with a JPG fallback.
export default function Photo({ slug, className = '', imgClassName = '', eager = false, alt }) {
  const img = IMAGES[slug]
  if (!img) return null
  return (
    <picture className={className}>
      <source srcSet={`${base}${slug}.webp`} type="image/webp" />
      <img
        src={`${base}${slug}.jpg`}
        width={img.w}
        height={img.h}
        alt={alt ?? img.alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchpriority={eager ? 'high' : undefined}
        decoding="async"
        className={`block h-full w-full object-cover ${imgClassName}`}
      />
    </picture>
  )
}
