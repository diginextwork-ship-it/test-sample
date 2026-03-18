import "../styles/about-us.css";
import founderPhoto from "../assets/about/founders_pic.jpeg";
import directorPhoto from "../assets/about/director.jpeg";
import PageBackButton from "../components/PageBackButton";

const highlights = [
  { value: "30K+", label: "Placements across India" },
  { value: "1000+", label: "Recruiters who have worked with our team" },
  { value: "75+", label: "Current team members" },
  { value: "100+", label: "Corporate and MNC partners empanelled" },
];

const values = [
  "Legacy of learning, leadership and love",
  "We celebrate every win and every success",
  "Exceptional recruitment solutions built on integrity, expertise and personalised service",
];

const milestones = [
  { year: "2016", label: "HireNext founded" },
  { year: "2020", label: "Scaled multi-city hiring" },
  { year: "2023", label: "Stronger enterprise partnerships" },
  { year: "2026", label: "10-year milestone" },
];

export default function AboutUs({ setCurrentPage }) {
  return (
    <main className="about-page ui-page">
      <div className="about-ambient about-ambient-one" aria-hidden="true" />
      <div className="about-ambient about-ambient-two" aria-hidden="true" />

      <section className="about-hero">
        <div className="about-container ui-shell">
          <div className="ui-page-back">
            <PageBackButton setCurrentPage={setCurrentPage} />
          </div>
          <div className="about-hero-panel">
            <p className="about-badge">About HireNext</p>
            <h1>10 Years of Building Careers and Teams That Last</h1>
            <p className="about-lead">
              Founded in 2016 by <strong>Shubham Barsaiya Sir</strong>, HireNext
              is completing a decade in 2026 with a mission to transform hiring
              outcomes across India.
            </p>
            <div className="milestone-strip">
              {milestones.map((item) => (
                <article className="milestone-card" key={item.year}>
                  <p className="milestone-year">{item.year}</p>
                  <p className="milestone-label">{item.label}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="about-highlights">
        <div className="about-container ui-shell">
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

      <section className="about-founder">
        <div className="about-container about-founder-grid ui-shell">
          <div className="founder-photo-slot" aria-label="Founder photo">
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
        <div className="about-container about-founder-grid about-founder-grid-director ui-shell">
          <div className="founder-photo-slot" aria-label="Director photo">
            <img
              src={directorPhoto}
              alt="Radhika mam"
              className="founder-photo"
            />
          </div>
          <div className="founder-copy">
            <h2>
              <strong>Radhika mam</strong>
            </h2>
            <p>Our Director</p>
            <p>
              She leads with clarity, discipline, and deep commitment to people,
              helping HireNext scale teams and relationships with consistency.
            </p>
            <p>
              With extensive experience in recruitment and team development,
              Radhika mam brings strategic vision and operational excellence to
              every initiative. Her focus on building long-term partnerships
              with both candidates and corporate clients has been instrumental
              in HireNext's growth across multiple sectors.
            </p>
            <p>
              Beyond her role, she is passionate about mentoring emerging talent
              and fostering an inclusive workplace culture where every team
              member can thrive and contribute meaningfully to our mission of
              transforming hiring outcomes.
            </p>
          </div>
        </div>
      </section>

      <section className="about-values">
        <div className="about-container ui-shell">
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
