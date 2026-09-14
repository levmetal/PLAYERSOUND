
import styles from "../styles/sidebar.module.css"
import { useRouter } from "next/router"
import Link from "next/link"
import { FaBars, FaTimes, FaHome, FaBook, FaInfoCircle } from "react-icons/fa"
import { useEffect, useState } from "react"

const NAV_ITEMS = [
    { href: "/", label: "Home", Icon: FaHome },
    { href: "/library", label: "Playlists", Icon: FaBook },
    { href: "/about", label: "About", Icon: FaInfoCircle },
]

const SideBar = () => {
    const [menuOpen, setMenuOpen] = useState(false)

    const router = useRouter()

    const handleOpenMenu = () => {
        setMenuOpen((open) => !open)
    }

    const closeMenu = () => setMenuOpen(false)

    // Nav-link clicks: on mobile this is a dropdown, so it should close after
    // navigating like any menu does. On desktop the same `menuOpen` state
    // instead means "rail manually expanded to show labels" — closing it on
    // every navigation there defeats the point of a persistent, always-open
    // layout element (it would collapse back on every single click even
    // though components/layout.jsx/pages/_app.js now keep SideBar mounted
    // across route changes specifically so this kind of state can persist).
    // 768px matches the rail/top-bar breakpoint in styles/tokens.css.
    const handleNavClick = () => {
        if (typeof window !== "undefined" && window.innerWidth <= 768) {
            closeMenu()
        }
    }

    // Mobile only in practice (desktop's collapsed rail has no scrim to
    // dismiss), but harmless to always listen for — Escape closes the open
    // dropdown/rail same as clicking the scrim or a nav link does.
    useEffect(() => {
        if (!menuOpen) return
        const handleKey = (e) => e.key === "Escape" && closeMenu()
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [menuOpen])

    const isActive = (path) => router.asPath === path

    return (
        <>
            {/* Mobile-only dim scrim behind the open dropdown (styles/sidebar.module.css
                hides it above the 768px nav-mode switch) — tap it to close, same as a
                nav link or Escape. */}
            {menuOpen && <div className={styles.navScrim} onClick={closeMenu} aria-hidden="true" />}

            <aside className={menuOpen ? styles.sidebar__expanded : styles.sidebar__collapsed}>
                <header className={styles.sideHeader}>
                    {/* Not a heading: this renders once above every page (pages/_app.js),
                        so an <h2> here would sit before each page's own <h1> in the DOM —
                        a broken heading order on every route. It's a persistent wordmark,
                        not a section heading. */}
                    <p className={styles.logo}>PlayerSound</p>

                    <button
                        type="button"
                        className={styles.navToggle}
                        onClick={handleOpenMenu}
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                    >
                        {menuOpen ? <FaTimes className={styles.sideBarIcon} /> : <FaBars className={styles.sideBarIcon} />}
                    </button>
                </header>

                <nav aria-label="Main">
                    <ul className={menuOpen ? `${styles.listbar} ${styles.listbarOpen}` : styles.listbar}>
                        {NAV_ITEMS.map(({ href, label, Icon }) => (
                            <li
                                key={href}
                                className={
                                    isActive(href)
                                        ? `${styles.listbar__option} ${styles.listbar__active}`
                                        : styles.listbar__option
                                }
                            >
                                <Link href={href}>
                                    <a
                                        onClick={handleNavClick}
                                        aria-current={isActive(href) ? "page" : undefined}
                                        title={label}
                                    >
                                        {label}
                                        <Icon className={styles.sideIcon} aria-hidden="true" />
                                    </a>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </>

    )
}
export default SideBar
