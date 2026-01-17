import S from 'saito-js/saito';

export default async (saito) => {
	saito.hash = (data) => S.hash(data);
};