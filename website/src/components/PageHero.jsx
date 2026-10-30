import Photo from './Photo.jsx'

// Image band at the top of inner pages: photo, dark overlay, title.
export default function PageHero({ image, eyebrow, title, children }) {
  return (
    <section className="relative isolate overflow-hidden bg-accent text-white">
      {image && (
        <div className="absolute inset-0 -z-10">
          <Photo slug={image} eager imgClassName="kenburns" />
          <div className="absolute inset-0 bg-overlay" />
          {/* A second, lighter layer keeps small white text above 4.5:1 on bright photos. */}
          <div className="absolute inset-0 bg-ink/25" />
        </div>
      )}
      <div className="page-x pb-12 pt-28 sm:pb-16 sm:pt-36">
        {eyebrow && <p className="fade-up text-sm font-medium uppercase tracking-wider text-white">{eyebrow}</p>}
        <h1 className="fade-up mt-2 max-w-[22ch] text-4xl text-white sm:text-5xl" style={{ animationDelay: '80ms' }}>
          {title}
        </h1>
        {children && (
          <div className="fade-up mt-4 max-w-prose text-lg text-white" style={{ animationDelay: '160ms' }}>
            {children}
          </div>
        )}
      </div>
    </section>
  )
}
