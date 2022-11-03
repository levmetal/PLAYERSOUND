

export function RemoveSpecialChar(titlefix){
    return titlefix = titlefix.replace(/[&\/\\#,+()$~%.'":*?<>{}__]/g, '');
}