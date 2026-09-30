import DocumentoDetalhe from "@/paginas/html/documento-detalhe";
import { UploadAnexo } from '@/components/anexos/upload/UploadAnexo';

export default function Page(props: PageProps<"/documentos/[id]">) {
  return (
    <>
      <DocumentoDetalhe {...props} />
      <UploadAnexo documentoId={"id-exemplo"} />
    </>
  );
}
