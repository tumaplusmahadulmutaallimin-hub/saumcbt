import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPersonNameAndTitle } from './formatName';

test('formatPersonNameAndTitle formats academic degrees without ALL CAPS', () => {
  assert.equal(formatPersonNameAndTitle('ARIF SYAIFUDIN, S.H'), 'Arif Syaifudin, S.H.');
  assert.equal(formatPersonNameAndTitle('Arif Syaifudin, S.H.'), 'Arif Syaifudin, S.H.');
  assert.equal(formatPersonNameAndTitle('AHMAD FAUZI, S.PD.I., M.PD.'), 'Ahmad Fauzi, S.Pd.I., M.Pd.');
  assert.equal(formatPersonNameAndTitle('PROF. DR. H. ABDULLAH MANSUR, S.AG., M.SI.'), 'Prof. Dr. H. Abdullah Mansur, S.Ag., M.Si.');
  assert.equal(formatPersonNameAndTitle('hj. siti aminah, s.kom'), 'Hj. Siti Aminah, S.Kom.');
  assert.equal(formatPersonNameAndTitle('.........................'), '.........................');
  assert.equal(formatPersonNameAndTitle(''), '');
});
