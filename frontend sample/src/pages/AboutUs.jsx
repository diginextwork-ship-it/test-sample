import "../styles/about-us.css";
import founderPhoto from "../assets/founders_pic.jpeg";

const highlights = [
  { value: "30K+", label: "Placements across India" },
  { value: "200+", label: "Recruiters who have worked with our team" },
  { value: "50+", label: "Current team members" },
  { value: "70+", label: "Corporate and MNC partners empanelled" },
];

const values = [
  "Legacy of learning, leadership and love",
  "We celebrate every win and every success",
  "Exceptional recruitment solutions built on integrity, expertise and personalised service",
];

export default function AboutUs() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <div className="about-container">
          <p className="about-badge">About HireNext</p>
          <h1>10 Years of Building Careers and Teams That Last</h1>
          <p className="about-lead">
            Founded in 2016 by <strong>Shubham Barsaiya Sir</strong>, HireNext
            is completing a decade in 2026 with a mission to transform hiring
            outcomes across India.
          </p>
        </div>
      </section>

      <section className="about-founder">
        <div className="about-container about-founder-grid">
          <div
            className="founder-photo-slot"
            aria-label="Founder photo"
          >
            <img
              src={founderPhoto}
              alt="Shubham Barsaiya Sir"
              className="founder-photo"
            />
          </div>
          <div className="founder-copy">
            <h2>Founder Story</h2>
            <p>
              HireNext was founded in 2016 by Shubham Barsaiya Sir with a vision
              to build a people-first recruitment company that delivers
              measurable business impact.
            </p>
            <p>
              Over the years, that vision has grown into a high-performing team
              known for trusted partnerships, reliable delivery, and a culture
              that celebrates progress.
            </p>
          </div>
        </div>
      </section>

      <section className="about-highlights">
        <div className="about-container">
          <h2>Impact at a Glance</h2>
          <div className="highlight-grid">
            {highlights.map((item) => (
              <article className="highlight-card" key={item.label}>
                <p className="highlight-value">{item.value}</p>
                <p className="highlight-label">{item.label}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-values">
        <div className="about-container">
          <h2>Our Culture and Commitment</h2>
          <div className="values-list">
            {values.map((value) => (
              <p className="value-item" key={value}>
                {value}
              </p>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
