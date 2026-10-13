import Link from "@/lib/AppLink";
import { lessons } from "@/lib/lesson";
import AppIcon from "./AppIcon";

export default function Page() {
  const firstUnit = lessons[0];
  const startLearningHref = firstUnit ? `/learn/${firstUnit.id}` : "/learn";
  const destinations = [
    { href: "/read/", title: "Read Coptic", description: "Explore a passage, one word at a time.", primary: true },
    { href: "/vocabulary/", title: "Vocabulary & review", description: "Keep the words you’re learning fresh." },
    { href: startLearningHref, title: "Start Learning", description: "Build your skills with guided lessons." },
    { href: "/dictionary", title: "Dictionary", description: "Look up a word and its meaning." },
    { href: "/translator", title: "Translator", description: "Translate text or check a Coptic photo." },
  ];

  return <main className="app-page home-page">
    <header className="app-page-header">
      <h1>Coptic</h1>
      <p>Read, understand, and remember Coptic.</p>
    </header>
    <nav className="home-destinations" aria-label="Explore Coptic">
      {destinations.map(item => <Link key={item.href} href={item.href} className={`home-destination${item.primary ? " home-destination--primary" : ""}`}>
        <span><span className="home-destination-title">{item.title}</span><span className="home-destination-description">{item.description}</span></span>
        <AppIcon name="arrow" />
      </Link>)}
    </nav>
    <Link href="/settings" aria-label="Open settings" className="desktop-settings mobile-chin-hide-on-mobile"><AppIcon name="settings" size={24} /></Link>
  </main>;
}
