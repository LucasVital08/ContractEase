/**
 * Document Export Service
 * Fornece funcionalidades de exportação para DOCX e XML (padrão e-Social/SPED).
 */
import type { Contract } from '@/types';

/**
 * Exporta o contrato para um arquivo HTML formatado para abrir corretamente no Microsoft Word.
 * Utiliza um Blob HTML com charset UTF-8 e tags do Word.
 */
export function exportContractToDOCX(contract: Contract) {
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${contract.title}</title>
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.5; padding: 40px; }
        h1 { color: #10b981; font-size: 24pt; text-align: center; }
        h2 { font-size: 14pt; margin-top: 20pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        p { font-size: 11pt; margin-bottom: 12pt; text-align: justify; }
        .meta { font-size: 10pt; color: #555; text-align: center; margin-bottom: 30pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 15pt; }
        th, td { border: 1px solid #ccc; padding: 8pt; text-align: left; font-size: 10pt; }
        th { background-color: #f3f4f6; }
      </style>
    </head>
    <body>
  `;

  const metaHtml = `
    <h1>${contract.title}</h1>
    <div class="meta">
      ID: ${contract.id} | Criado em: ${new Date(contract.createdAt).toLocaleDateString('pt-BR')} | Status: ${contract.status}
    </div>
    <p><strong>Descrição:</strong> ${contract.description}</p>
  `;

  let clausesHtml = `<h2>Cláusulas</h2>`;
  const sortedClauses = [...contract.clauses].sort((a, b) => a.order - b.order);
  for (const clause of sortedClauses) {
    clausesHtml += `
      <p><strong>${clause.order}. ${clause.title}</strong><br/>
      ${clause.content}</p>
    `;
  }

  let partiesHtml = `<h2>Partes</h2><table><tr><th>Nome</th><th>Papel</th><th>Assinado em</th></tr>`;
  for (const party of contract.parties) {
    partiesHtml += `
      <tr>
        <td>${party.name}</td>
        <td>${party.role}</td>
        <td>${party.signedAt ? new Date(party.signedAt).toLocaleDateString('pt-BR') : 'Pendente'}</td>
      </tr>
    `;
  }
  partiesHtml += `</table>`;

  const footer = `</body></html>`;
  
  const fullHtml = header + metaHtml + clausesHtml + partiesHtml + footer;

  const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${contract.title.replace(/[^a-zA-Z0-9]/g, '_')}_${contract.id}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta o contrato para XML no padrão genérico (preparado para e-Social/SPED).
 */
export function exportContractToXML(contract: Contract) {
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Contract xmlns="http://www.contractease.com/schema/v1">
  <Metadata>
    <ID>${contract.id}</ID>
    <Title>${contract.title}</Title>
    <Type>${contract.type}</Type>
    <Status>${contract.status}</Status>
    <CreatedAt>${contract.createdAt}</CreatedAt>
    <ExpiresAt>${contract.expiresAt}</ExpiresAt>
    ${contract.contractHash ? `<Hash>${contract.contractHash}</Hash>` : ''}
    ${contract.stellarTxHash ? `<BlockchainTx>${contract.stellarTxHash}</BlockchainTx>` : ''}
  </Metadata>
  <Parties>
    ${contract.parties.map(p => `
    <Party id="${p.id}">
      <Name>${p.name}</Name>
      <Email>${p.email}</Email>
      <Role>${p.role}</Role>
      ${p.cpf ? `<Document type="CPF">${p.cpf}</Document>` : ''}
      <Signature>
        <Status>${p.signedAt ? 'Signed' : 'Pending'}</Status>
        ${p.signedAt ? `<Timestamp>${p.signedAt}</Timestamp>` : ''}
        ${p.ipAddress ? `<IPAddress>${p.ipAddress}</IPAddress>` : ''}
        ${p.signatureType ? `<Type>${p.signatureType}</Type>` : ''}
      </Signature>
    </Party>`).join('')}
  </Parties>
  <Clauses>
    ${contract.clauses.map(c => `
    <Clause order="${c.order}">
      <Title>${c.title}</Title>
      <Content><![CDATA[${c.content}]]></Content>
    </Clause>`).join('')}
  </Clauses>
</Contract>`;

  const blob = new Blob([xmlContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${contract.title.replace(/[^a-zA-Z0-9]/g, '_')}_${contract.id}.xml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
