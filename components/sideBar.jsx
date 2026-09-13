
import styles from "../styles/sidebar.module.css"
import { useRouter } from "next/router"
import Link from "next/link"
import { FaBars, FaTimes, FaHome, FaBook, FaInfoCircle } from "react-icons/fa"
import { useEffect, useState } from "react"

const SideBar = () => {
    const [menuOpen, setMenuOpen] = useState(false)

    const router = useRouter()

    const handleOpenMenu = () => {
        setMenuOpen((open) => !open)
    }

    const closeMenu = () => setMenuOpen(false)

    // Mobile only in practice (desktop's collapsed rail has no scrim to
    // dismiss), but harmless to always listen for — Escape closes the open
    // dropdown/rail same as clicking the scrim or a nav link does.
    useEffect(() => {
        if (!menuOpen) return
        const handleKey = (e) => e.key === "Escape" && closeMenu()
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [menuOpen])

    const optionClass = (path) =>
        router.asPath === path
            ? `${styles.listbar__option} ${styles.listbar__active}`
            : styles.listbar__option

    return (
        <>
            {/* Mobile-only dim scrim behind the open dropdown (styles/sidebar.module.css
                hides it above the 768px nav-mode switch) — tap it to close, same as a
                nav link or Escape. */}
            {menuOpen && <div className={styles.navScrim} onClick={closeMenu} aria-hidden="true" />}

            <aside className={menuOpen ? styles.sidebar__expanded : styles.sidebar__collapsed}>
                <header className={styles.sideHeader}>
                    <h2 className={styles.logo}>PlayerSound</h2>

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

                <ul className={menuOpen ? `${styles.listbar} ${styles.listbarOpen}` : styles.listbar}>
                    <li className={optionClass("/")}>
                        <Link href="/">
                            <a onClick={closeMenu}>Home
                                <FaHome className={styles.sideIcon} />
                            </a>
                        </Link>
                    </li>
                    <li className={optionClass("/library")}>
                        <Link href="/library">
                            <a onClick={closeMenu}>Playlists

                                <FaBook className={styles.sideIcon} />
                            </a>
                        </Link>
                    </li>

                    <li className={optionClass("/about")}>
                        <Link href="/about">
                            <a onClick={closeMenu}>About
                                <FaInfoCircle className={styles.sideIcon} />

                            </a>
                        </Link>
                    </li>
                </ul>

            </aside>
        </>

    )
}
export default SideBar
