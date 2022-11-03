import styles from '../styles/player.module.css'

const Backdrop = ({ children, onClick }) => {
    return (
      <div
        onClick={onClick}
        className={styles.backdrop}
       
      >
        {children}
      </div>
    )
  }
  
  export default Backdrop