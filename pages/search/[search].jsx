

import Loader from '../../components/loader'
import { memo ,Suspense} from 'react'
import dynamic from 'next/dynamic'
import styles from '../../styles/search.module.css'
const SoundList = dynamic(() => import('../../components/soundList'), {
  suspense: true,
})

const Search = memo(function Search({ data }) {

  let dataSearch = [data]

  return (
    <>

      <div className={styles.container}>

          <Suspense fallback={<Loader/>}>

          <SoundList dataSearch={dataSearch} />
          </Suspense>

      </div>


    </>


  )
})

export default Search

export async function getServerSideProps(context) {

  const { query } = context
  const { search } = query
  try {
    const searchApiBase =
      process.env.NEXT_PUBLIC_SEARCH_API_BASE ||
      (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
      `http://localhost:${process.env.PORT || 3000}`
    const response = await fetch(`${searchApiBase}/api/search/${search}`)
    const data = await response.json()

    return {
      props: { data }

    }

  } catch (error) {
    console.log(error);
  }

}
