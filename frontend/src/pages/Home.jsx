import React from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <section className="hero container">
        <div>
          <h1>
            Get Your Doubts<br />
            <span className="accent">Resolved Instantly</span>
          </h1>
          <p>
            Connect with expert tutors 24/7 and get personalized help for your academic questions.
            Learning made simple with Clarify.
          </p>
          <div style={{ marginTop: 20 }}>
            <Link to="/signup" className="btn primary">Get Started Free →</Link>
          </div>
        </div>
        <div className="card">
          <img src="https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1200&auto=format&fit=crop" alt="Study" style={{ width: '100%', borderRadius: 12 }} />
          <div className="card" style={{ marginTop: 12 }}>
            <strong>✓ Doubt Resolved!</strong>
            <div className="muted">in 2 minutes</div>
          </div>
        </div>
      </section>

      <section className="container">
        <h2 className="section-title">Why Choose Clarify?</h2>
        <p className="section-sub">Everything you need to succeed in your academic journey</p>
        <div className="grid">
          {[
            { t: 'Instant Chat Support', d: 'Connect with tutors in real-time through our messaging platform.' },
            { t: '24/7 Availability', d: 'Get help anytime, anywhere. Our tutors are always online.' },
            { t: 'Expert Tutors', d: 'Learn from verified experts with proven track records.' },
            { t: 'Personalized Learning', d: 'Solutions tailored to your learning style and pace.' },
            { t: 'All Subjects', d: 'Math, Science, Languages, Arts — we cover everything.' },
            { t: 'Safe & Secure', d: 'Your privacy and data security are our top priorities.' }
          ].map((c, i) => (
            <div key={i} className="card">
              <h3>{c.t}</h3>
              <p className="muted">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container">
        <h2 className="section-title">How It Works</h2>
        <p className="section-sub">Getting help is as easy as 1-2-3</p>
        <div className="how-steps">
          {[
            { t: 'Ask Your Question', d: "Type your doubt or upload an image of the problem." },
            { t: 'Connect with a Tutor', d: "Get matched instantly with an expert in the subject." },
            { t: 'Get Solutions', d: "Receive step-by-step explanations and clear your doubts." },
          ].map((s, i) => (
            <div key={i} className="step card">
              <div className="num">{String(i + 1).padStart(2, '0')}</div>
              <h3>{s.t}</h3>
              <p className="muted" style={{ textAlign: 'center' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta container">
        <h2 className="section-title">Ready to Ace Your Studies?</h2>
        <p className="section-sub">Join Clarify today and experience learning like never before.</p>
        <Link to="/signup" className="btn primary">Start Learning Now →</Link>
      </section>

      <footer className="footer">
        <div className="container cols">
          <div>
            <div className="brand"><div className="badge">C</div> Clarify</div>
            <p className="muted">Making learning accessible and effective for students worldwide.</p>
          </div>
          <div>
            <strong>Product</strong>
            <div className="muted"><Link to="/features">Features</Link><br/> <Link to="/pricing">Pricing</Link><br/> <Link to="/how">How It Works</Link></div>
          </div>
          <div>
            <strong>Company</strong>
            <div className="muted"><Link to="/about">About Us</Link><br/> <Link to="/contact">Contact</Link></div>
          </div>
          <div>
            <strong>Support</strong>
            <div className="muted"><Link to="/help">Help Center</Link><br/> <Link to="/terms">Terms</Link></div>
          </div>
        </div>
        <div className="container muted">© 2026 Clarify. All rights reserved.</div>
      </footer>
    </div>
  )
}
