
import styles from "../styles/sidebar.module.css"
import { useRouter } from "next/router"
import Link from "next/link"
import { FaBars, FaOutdent, FaHome, FaBook, FaListUl, FaInfoCircle } from "react-icons/fa"
import { useState } from "react"
import { v4 as uuidv4 } from 'uuid';


const SideBar = () => {
    const [menuOpen, setMenuOpen] = useState(false)

    const router = useRouter()


    const handleOpenMenu = () => {
        const prevValue = menuOpen
        setMenuOpen(!prevValue)

    }


    return (

        <aside className={menuOpen ? styles.sidebar__container : styles.sidebar__open}>
            <header className={styles.sideHeader}>
                <h2  >PlayerSound</h2>

                {menuOpen ? <FaOutdent onClick={handleOpenMenu} className={styles.sideBarIcon} /> :
                    <FaBars onClick={handleOpenMenu} className={styles.sideBarIcon} />}
            </header>

            <ul className={styles.listbar}>
                <li key={uuidv4()} className={styles.listbar__option} style={{ background: router.asPath === "/" ? "#0A0033" : "transparent" }}>
                    <Link href="/">
                        <a>Home
                            <FaHome className={styles.sideIcon} />
                        </a>
                    </Link>
                </li>
                <li key={uuidv4()} className={styles.listbar__option} style={{ background: router.asPath === "/library" ? "#0A0033" : "transparent" }}>
                    <Link href="/library">
                        <a >Library

                            <FaBook className={styles.sideIcon} />
                        </a>
                    </Link>
                </li>

                <li key={uuidv4()} className={styles.listbar__option} style={{ background: router.asPath === "/about" ? "#0A0033" : "transparent" }}>
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