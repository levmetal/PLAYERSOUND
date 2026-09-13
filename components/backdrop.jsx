import styles from '../styles/player.module.css'

const Backdrop = ({ children, onClick, closing }) => {
    return (
      <div
        onClick={onClick}
        className={closing ? `${styles.backdrop} ${styles.backdropClosing}` : styles.backdrop}
      >
        {children}
      </div>
    )
  }

  export default Backdrop
