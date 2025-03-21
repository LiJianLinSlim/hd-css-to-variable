declare module 'image-to-base64' {
    function imageToBase64(path: string): Promise<string>;
    export default imageToBase64;
}