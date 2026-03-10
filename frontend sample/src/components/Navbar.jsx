import { useState } from "react";
import logoImage from "../assets/Logo.png";
import "../styles/navbar.css";

export default function Navbar({ setCurrentPage, currentPage }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavClick = (page) => {
    setCurrentPage(page);
    setIsMenuOpen(false);
  };

  return (
    <nav className={`navbar ${currentPage === "home" ? "navbar-home" : ""}`}>
      <div className="navbar-container">
        <div className="navbar-brand">
          <div className="logo" onClick={() => handleNavClick("home")}>
            <img src={logoImage} alt="hirenext logo" className="logo-image" />
          </div>
        </div>

        <button
          className={`hamburger ${isMenuOpen ? "open" : ""}`}
          onClick={toggleMenu}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className={`navbar-menu ${isMenuOpen ? "open" : ""}`}>
          <div className="navbar-links">
            <a
              href="#"
              className="nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("jobs");
              }}
            >
              Search all jobs
            </a>

            <a
              href="/about-us"
              className="nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("aboutus");
              }}
            >
              About Us
            </a>

            <a
              href="/gallery"
              className="nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("gallery");
              }}
            >
              Gallery
            </a>

            <a
              href="/contactus"
              className="nav-link"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick("contactus");
              }}
            >
              Contact Us
            </a>
          </div>

          <a
            href="/#"
            className="nav-link"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick("aboutus");
            }}
          >
           Blog
          </a>

          <div className="navbar-actions">
            <button
              className="btn btn-secondary"
              onClick={() => handleNavClick("schedulecall")}
            >
              Schedule A Call Now
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
