import { motion } from 'framer-motion'
import { FaMusic } from 'react-icons/fa'

const Loader =()=>{
return( 
  <div className="container">

 <motion.div
className='loader'
initial={{ scale: 1, opacity: 0.25, rotate: 0, y: [0, 0, 0] }}
animate={{ scale: 0.9, opacity: 0.75, rotate: 360, y: [-50, 0, 50] }}
transition={{
  duration: 2,
  
  repeat: Infinity,
  repeatType: 'reverse'
  
}}
>
<FaMusic style={{ color: "#beadff" }} size={64} /></motion.div>
  </div>
)}
export default Loader