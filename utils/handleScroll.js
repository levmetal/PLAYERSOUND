export const handleScrollLeft = (scrollSearchList) => {
    scrollSearchList.current.scrollBy({
        top: 0,
        left: -1000,
        behavior: "smooth"
    })
}
export const handleScrollright = (scrollSearchList) => {
    scrollSearchList.current.scrollBy(
      {
        top: 0,
        left: 1000,
        behavior: "smooth"
      }
    )

  }