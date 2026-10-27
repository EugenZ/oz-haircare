import Link from "next/link";

/** Same asset and markup everywhere the OZ SPA wordmark appears in the header. */
export const SITE_BRAND_LOGO_SRC = "/oz-spa-logo.png";

export function SiteBrand({
  href,
  ariaLabel,
}: {
  href: string;
  ariaLabel: string;
}) {
  const logo = <img className="brand-logo" src={SITE_BRAND_LOGO_SRC} alt="" />;

  if (href.startsWith("#")) {
    return (
      <a className="brand" href={href} aria-label={ariaLabel}>
        {logo}
      </a>
    );
  }

  return (
    <Link className="brand" href={href} aria-label={ariaLabel}>
      {logo}
    </Link>
  );
}
