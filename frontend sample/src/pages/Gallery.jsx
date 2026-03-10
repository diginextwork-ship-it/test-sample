import { useMemo, useState } from "react";
import "../styles/gallery.css";
import PageBackButton from "../components/PageBackButton";

const officeImageModules = import.meta.glob(
  "../assets/gallery/office/*.{png,jpg,jpeg,webp,avif,gif}",
  { eager: true, import: "default" }
);

const campaignImageModules = import.meta.glob(
  "../assets/gallery/campaign/*.{png,jpg,jpeg,webp,avif,gif}",
  { eager: true, import: "default" }
);

const normalizeImages = (imageModules) =>
  Object.entries(imageModules)
    .map(([path, src]) => {
      const fileName = String(path).split("/").pop() || "gallery-image";
      const label = fileName
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
      return { src, alt: label, key: fileName };
    })
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

const officeImages = normalizeImages(officeImageModules);
const campaignImages = normalizeImages(campaignImageModules);

const categoryCards = [
  {
    key: "office",
    title: "Office",
    description: "Inside our workplace, team culture, and daily operations.",
    preview: officeImages[0]?.src || null,
    count: officeImages.length,
  },
  {
    key: "campaign",
    title: "Campaign",
    description: "Hiring drives, outreach campaigns, and event highlights.",
    preview: campaignImages[0]?.src || null,
    count: campaignImages.length,
  },
];

export default function Gallery({ setCurrentPage }) {
  const [activeCategory, setActiveCategory] = useState(null);

  const activeImages = useMemo(() => {
    if (activeCategory === "office") return officeImages;
    if (activeCategory === "campaign") return campaignImages;
    return [];
  }, [activeCategory]);

  const activeCategoryTitle =
    activeCategory === "office"
      ? "Office"
      : activeCategory === "campaign"
      ? "Campaign"
      : "";

  return (
    <main className="gallery-page ui-page">
      <div className="gallery-ambient gallery-ambient-one" aria-hidden="true" />
      <div className="gallery-ambient gallery-ambient-two" aria-hidden="true" />

      <section className="gallery-hero ui-shell">
        <div className="ui-page-back">
          <PageBackButton setCurrentPage={setCurrentPage} />
        </div>
        <p className="gallery-badge">HireNext Gallery</p>
        <h1>Moments From Our Hiring Journey</h1>
        <p>A quick look at our team culture, events, and hiring milestones.</p>
      </section>

      <section className="gallery-grid-wrap ui-shell">
        {!activeCategory ? (
          <div className="gallery-category-grid">
            {categoryCards.map((category, index) => (
              <button
                type="button"
                className="gallery-category-card"
                key={category.key}
                style={{ "--gallery-delay": `${Math.min(index * 120, 400)}ms` }}
                onClick={() => setActiveCategory(category.key)}
              >
                <div className="gallery-category-preview">
                  {category.preview ? <img src={category.preview} alt={category.title} /> : null}
                </div>
                <div className="gallery-category-content">
                  <h2>{category.title}</h2>
                  <p>{category.description}</p>
                  <span>{category.count} photos</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="gallery-active-panel">
            <div className="gallery-active-header">
              <h2>{activeCategoryTitle} Photos</h2>
              <button type="button" className="gallery-back-btn" onClick={() => setActiveCategory(null)}>
                Back to categories
              </button>
            </div>
            {activeImages.length === 0 ? (
              <p className="gallery-empty">No images found in this category.</p>
            ) : (
              <div className="gallery-grid">
                {activeImages.map((image, index) => (
                  <article
                    className="gallery-card"
                    key={image.key}
                    style={{ "--gallery-delay": `${Math.min(index * 70, 700)}ms` }}
                  >
                    <img src={image.src} alt={image.alt} loading="lazy" />
                    <div className="gallery-card-overlay">{image.alt}</div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
