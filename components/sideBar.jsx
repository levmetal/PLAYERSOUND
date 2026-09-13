
import styles from "../styles/sidebar.module.css"
import { useRouter } from "next/router"
import Link from "next/link"
import { FaBars, FaOutdent, FaHome, FaBook, FaInfoCircle } from "react-icons/fa"
import { useState } from "react"


const SideBar = () => {
    const [menuOpen, setMenuOpen] = useState(false)

    const router = useRouter()

    const handleOpenMenu = () => {
        setMenuOpen(!menuOpen)
    }

    const optionClass = (path) =>
        router.asPath === path
            ? `${styles.listbar__option} ${styles.listbar__active}`
            : styles.listbar__option

    return (

        <aside className={menuOpen ? styles.sidebar__expanded : styles.sidebar__collapsed}>
            <header className={styles.sideHeader}>
                <h2  >PlayerSound</h2>

                {menuOpen ? <FaOutdent onClick={handleOpenMenu} className={styles.sideBarIcon} /> :
                    <FaBars onClick={handleOpenMenu} className={styles.sideBarIcon} />}
            </header>

            <ul className={styles.listbar}>
                <li className={optionClass("/")}>
                    <Link href="/">
                        <a>Home
                            <FaHome className={styles.sideIcon} />
                        </a>
                    </Link>
                </li>
                <li className={optionClass("/library")}>
                    <Link href="/library">
                        <a >Playlists

                            <FaBook className={styles.sideIcon} />
                        </a>
                    </Link>
                </li>

                <li className={optionClass("/about")}>
                    <Link href="/about">
                        <a>About
                            <FaInfoCircle className={styles.sideIcon} />

                        </a>
                    </Link>
                </li>
            </ul>

        </aside>


    )
}
export default SideBar
