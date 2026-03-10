import "../styles/contactus.css";
import PageBackButton from "../components/PageBackButton";

export default function Contact({ setCurrentPage }) {
  return (
    <main className="contactus-page ui-page">
      <section className="contactus-container ui-shell">
        <div className="ui-page-back">
          <PageBackButton setCurrentPage={setCurrentPage} />
        </div>
        <div className="contactus-header">
          <h1>contact us</h1>
          <p>Choose the fastest way to reach our team.</p>
        </div>

        <div className="contactus-grid">
          <a className="contact-card" href="tel:+919893083853">
            <span className="contact-card-badge">call now</span>
            <h2>+91 9893083853</h2>
            <p>Tap to call directly and talk with our team.</p>
            <span className="contact-card-cta">Call now</span>
          </a>

          <a
            className="contact-card"
            href="https://maps.app.goo.gl/F7gcbftUCUwLMo1V8"
            target="_blank"
            rel="noreferrer"
          >
            <span className="contact-card-badge">locate us</span>
            <h2>office location</h2>
            <p>Open Google Maps to get directions to our location.</p>
            <span className="contact-card-cta">Open map</span>
          </a>
        </div>
      </section>
    </main>
  );
}
