declare module 'pdf-parse' {
  const pdfParse: (buffer: Buffer) => Promise<{ text: string }>
  export default pdfParse
}
